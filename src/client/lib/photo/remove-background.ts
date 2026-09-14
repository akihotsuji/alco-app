import {
  PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS,
  PHOTO_CUTOUT_MASK,
  PHOTO_CUTOUT_MODEL_SIZE,
  PHOTO_CUTOUT_SHADOW,
} from "@/shared/constants.ts";
import { estimateBottleUpright, restoreMaskAspect, type UprightDecision } from "./cutout-angle.ts";
import {
  applyAlphaMask,
  flattenMaskOutput,
  normalizeU2NetMask,
  packU2NetTensor,
  raceWithTimeout,
} from "./cutout-mask.ts";
import {
  probeWebGpuAdapter,
  resolveCutoutProviderPreference,
  shouldAttemptWebGpu,
  shouldFallbackToWasm,
  type CutoutExecProvider,
} from "./cutout-provider.ts";
import { type BottleMaskFeatures, measureBottleMask, refineBottleMask } from "./cutout-quality.ts";
import { CutoutError, type CutoutTiming, emptyCutoutTiming, toCutoutFailureReason } from "./cutout-result.ts";
import { rotateRgbaAndMask, trimTransparent } from "./cutout-rotate.ts";
import {
  blockGpuThisSession,
  getCutoutRuntime,
  isGpuBlockedThisSession,
  readTensorFloat32,
  releaseCutoutRuntime,
  resolveOrtWasmPaths,
  type LoadedRuntime,
} from "./cutout-runtime.ts";
import { type CutoutQueuePolicy, createCutoutScheduler } from "./cutout-scheduler.ts";
import { supportsWasmSimd } from "./filter-support.ts";
import { type CropRect, computeCutoutPlacement, type OutputSize } from "./geometry.ts";

export type RemoveBackgroundProgress = {
  percent?: number;
  firstDownload: boolean;
};

export type SegmentationTiming = Pick<
  CutoutTiming,
  | "modelDownloadMs"
  | "ortLoadMs"
  | "sessionCreateMs"
  | "preprocessMs"
  | "queueWaitMs"
  | "inferenceMs"
  | "postprocessMs"
  | "provider"
  | "fallback"
>;

export type BottleSegmentation = {
  /** cleanup 済み。モデル解像度（`PHOTO_CUTOUT_MODEL_SIZE` 四方） */
  mask: Uint8Array;
  modelSize: number;
  features: BottleMaskFeatures;
  upright: UprightDecision;
  provider: CutoutExecProvider;
  fallback: boolean;
  timing: SegmentationTiming;
};

export type SegmentBottleOptions = {
  onProgress?: (progress: RemoveBackgroundProgress) => void;
  /** pending のうちに不要になったら取り消す（実行中の推論は止められないので結果を捨てる） */
  signal?: AbortSignal;
  /** 省略時はプレビュー向け latest */
  queue?: CutoutQueuePolicy;
};

export type ComposeCutoutInput = {
  source: HTMLCanvasElement;
  roi: CropRect;
  mask: Uint8Array;
  modelSize: number;
  output: OutputSize;
  rotationDegrees: number;
};

/** 推論は端末内で 1 本ずつ。プレビューは latest、保存・バッチは fifo */
const scheduler = createCutoutScheduler();

export function getCutoutSchedulerStats(): { started: number; superseded: number } {
  return scheduler.stats;
}

export function supportsWasmCutout(): boolean {
  return typeof WebAssembly !== "undefined" && supportsWasmSimd();
}

export function supportsBackgroundRemoval(): boolean {
  return supportsWasmCutout() || (typeof navigator !== "undefined" && "gpu" in navigator);
}

export { resolveOrtWasmPaths };

/**
 * 未補正の推論 ROI キャンバスから被写体マスクを求める。失敗はすべて `CutoutError`。
 * 成功時のマスクは cleanup と品質判定を通っている。角度は元縦横比へ戻してから推定する。
 */
export async function segmentBottle(
  input: HTMLCanvasElement,
  options: SegmentBottleOptions = {},
): Promise<BottleSegmentation> {
  if (!supportsBackgroundRemoval()) {
    throw new CutoutError("unsupported");
  }
  const preference = resolveCutoutProviderPreference();
  const gpuOk =
    shouldAttemptWebGpu({ preference, gpuBlocked: isGpuBlockedThisSession() }) &&
    (await probeWebGpuAdapter());
  const firstProvider: CutoutExecProvider = gpuOk ? "webgpu" : "wasm";
  if (firstProvider === "wasm" && !supportsWasmCutout()) {
    throw new CutoutError("unsupported");
  }

  try {
    return await segmentBottleWithProvider(input, firstProvider, options, false);
  } catch (error) {
    const aborted = options.signal?.aborted === true;
    const reason = toCutoutFailureReason(error);
    if (!shouldFallbackToWasm({ attempted: firstProvider, reason, aborted })) {
      throw error;
    }
    if (!supportsWasmCutout()) {
      throw error;
    }
    blockGpuThisSession();
    await releaseCutoutRuntime();
    return segmentBottleWithProvider(input, "wasm", options, true);
  }
}

async function segmentBottleWithProvider(
  input: HTMLCanvasElement,
  provider: CutoutExecProvider,
  options: SegmentBottleOptions,
  fallback: boolean,
): Promise<BottleSegmentation> {
  const timing: SegmentationTiming = emptyCutoutTiming();
  timing.provider = provider;
  timing.fallback = fallback;
  const modelSize = PHOTO_CUTOUT_MODEL_SIZE;

  const preprocessStart = performance.now();
  const modelCanvas = resizeToModel(input, modelSize);
  const modelCtx = modelCanvas.getContext("2d");
  if (!modelCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const packed = packU2NetTensor(modelCtx.getImageData(0, 0, modelSize, modelSize).data);
  timing.preprocessMs = elapsed(preprocessStart);

  const loaded = await getCutoutRuntime({ provider, onProgress: options.onProgress });
  timing.modelDownloadMs = loaded.timing.modelDownloadMs;
  timing.ortLoadMs = loaded.timing.ortLoadMs;
  timing.sessionCreateMs = loaded.timing.sessionCreateMs;
  const output = await runSession(loaded, packed, modelSize, options, timing);

  const postStart = performance.now();
  let flat: Float32Array;
  try {
    flat = flattenMaskOutput(output, modelSize);
  } catch (error) {
    throw new CutoutError("invalid_output", "mask shape", { cause: error });
  }
  const refined = refineBottleMask(normalizeU2NetMask(flat), modelSize, modelSize);
  const restored = restoreMaskAspect(refined.mask, modelSize, input.width, input.height);
  const upright = refined.validation.ok
    ? estimateBottleUpright({
        mask: restored,
        width: input.width,
        height: input.height,
        features: measureBottleMask(restored, input.width, input.height),
      })
    : {
        tiltDegrees: 0,
        correctionDegrees: 0,
        applied: false,
        reason: "empty" as const,
      };
  timing.postprocessMs = elapsed(postStart);
  if (!refined.validation.ok) {
    throw new CutoutError(refined.validation.reason, refined.validation.detail);
  }
  return {
    mask: refined.mask,
    modelSize,
    features: refined.validation.features,
    upright,
    provider,
    fallback,
    timing,
  };
}

async function runSession(
  loaded: LoadedRuntime,
  packed: Float32Array,
  modelSize: number,
  options: SegmentBottleOptions,
  timing: SegmentationTiming,
): Promise<Float32Array> {
  const { session, ort } = loaded;
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new CutoutError("invalid_output", "model io names");
  }
  const results = await scheduler.schedule(
    async (context) => {
      timing.queueWaitMs = context.queueWaitMs;
      const inferenceStart = performance.now();
      const tensor = new ort.Tensor("float32", packed, [1, 3, modelSize, modelSize]);
      const run = session.run({ [inputName]: tensor });
      context.hold(run);
      try {
        const outputs = await raceWithTimeout(run, PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS);
        const output = outputs[outputName];
        if (!output) {
          throw new CutoutError("invalid_output", "output tensor");
        }
        try {
          return await readTensorFloat32(output);
        } finally {
          output.dispose?.();
        }
      } catch (error) {
        throw error instanceof CutoutError
          ? error
          : new CutoutError("inference", undefined, { cause: error });
      } finally {
        timing.inferenceMs = elapsed(inferenceStart);
      }
    },
    { signal: options.signal, policy: options.queue ?? "latest" },
  );
  return results;
}

/**
 * マスクを作業画像の ROI へ当て、角度補正したあと 2:3 へ下端揃え + 落ち影で置く。
 * 影は最終キャンバスに描き、瓶と一緒に回さない。
 */
export function composeBottleCutout(input: ComposeCutoutInput): HTMLCanvasElement {
  const roi = extractRoi(input.source, input.roi);
  const scaled = scaleMask(input.mask, input.modelSize, roi.width, roi.height);
  const roiCtx = roi.getContext("2d");
  if (!roiCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const image = roiCtx.getImageData(0, 0, roi.width, roi.height);
  applyAlphaMask(image.data, scaled);
  const rotated = trimTransparent(
    rotateRgbaAndMask({
      rgba: image.data,
      mask: scaled,
      width: roi.width,
      height: roi.height,
      degrees: input.rotationDegrees,
    }),
  );
  const cut = document.createElement("canvas");
  cut.width = rotated.width;
  cut.height = rotated.height;
  const cutCtx = cut.getContext("2d");
  if (!cutCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  cutCtx.putImageData(new ImageData(rotated.rgba, rotated.width, rotated.height), 0, 0);
  const dest = document.createElement("canvas");
  dest.width = input.output.width;
  dest.height = input.output.height;
  paintCutoutOnCanvas(cut, dest);
  return dest;
}

function paintCutoutOnCanvas(cutout: HTMLCanvasElement, dest: HTMLCanvasElement): void {
  const srcCtx = cutout.getContext("2d");
  const destCtx = dest.getContext("2d");
  if (!srcCtx || !destCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const image = srcCtx.getImageData(0, 0, cutout.width, cutout.height);
  const box = alphaBoxFromRgba(image.data, cutout.width, cutout.height, PHOTO_CUTOUT_MASK.bboxAlpha) ?? {
    x: 0,
    y: 0,
    width: cutout.width,
    height: cutout.height,
  };
  const placed = computeCutoutPlacement({
    sourceWidth: box.width,
    sourceHeight: box.height,
    canvasWidth: dest.width,
    canvasHeight: dest.height,
  });
  destCtx.clearRect(0, 0, dest.width, dest.height);
  destCtx.fillStyle = PHOTO_CUTOUT_SHADOW.color;
  destCtx.beginPath();
  destCtx.ellipse(
    placed.shadow.x,
    placed.shadow.y,
    placed.shadow.rx,
    placed.shadow.ry,
    0,
    0,
    Math.PI * 2,
  );
  destCtx.fill();
  destCtx.drawImage(
    cutout,
    box.x,
    box.y,
    box.width,
    box.height,
    placed.x,
    placed.y,
    placed.width,
    placed.height,
  );
}

function alphaBoxFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return null;
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function extractRoi(source: HTMLCanvasElement, roi: CropRect): HTMLCanvasElement {
  const width = Math.max(1, Math.round(roi.sw));
  const height = Math.max(1, Math.round(roi.sh));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, roi.sx, roi.sy, roi.sw, roi.sh, 0, 0, width, height);
  return canvas;
}

function resizeToModel(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  return canvas;
}

function scaleMask(mask: Uint8Array, modelSize: number, width: number, height: number): Uint8Array {
  const src = document.createElement("canvas");
  src.width = modelSize;
  src.height = modelSize;
  const srcCtx = src.getContext("2d");
  if (!srcCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const image = srcCtx.createImageData(modelSize, modelSize);
  for (let i = 0; i < modelSize * modelSize; i += 1) {
    const value = mask[i] ?? 0;
    const offset = i * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  srcCtx.putImageData(image, 0, 0);
  const dest = document.createElement("canvas");
  dest.width = width;
  dest.height = height;
  const destCtx = dest.getContext("2d");
  if (!destCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = "high";
  destCtx.drawImage(src, 0, 0, width, height);
  const scaled = destCtx.getImageData(0, 0, width, height);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = scaled.data[i * 4] ?? 0;
  }
  return out;
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
