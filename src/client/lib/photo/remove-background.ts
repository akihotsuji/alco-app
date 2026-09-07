import type { InferenceSession } from "onnxruntime-web";
import {
  PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
  PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS,
  PHOTO_CUTOUT_MASK,
  PHOTO_CUTOUT_MODEL_SIZE,
  PHOTO_CUTOUT_ORT_MJS_FILE,
  PHOTO_CUTOUT_ORT_WASM_FILE,
  PHOTO_CUTOUT_ORT_WASM_PATH,
  PHOTO_CUTOUT_SHADOW,
} from "@/shared/constants.ts";
import { applyPreset, type ColorPreset } from "./apply-preset.ts";
import {
  applyAlphaMask,
  flattenMaskOutput,
  normalizeU2NetMask,
  packU2NetTensor,
  raceWithTimeout,
} from "./cutout-mask.ts";
import { loadCutoutModelBytes } from "./cutout-model-cache.ts";
import { type BottleMaskFeatures, refineBottleMask } from "./cutout-quality.ts";
import { CutoutError, type CutoutTiming, emptyCutoutTiming } from "./cutout-result.ts";
import { createLatestOnlyScheduler } from "./cutout-scheduler.ts";
import { supportsWasmSimd } from "./filter-support.ts";
import { alphaBoundingBox, computeCutoutPlacement } from "./geometry.ts";

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
>;

export type BottleSegmentation = {
  /** cleanup 済み。モデル解像度（`PHOTO_CUTOUT_MODEL_SIZE` 四方） */
  mask: Uint8Array;
  modelSize: number;
  features: BottleMaskFeatures;
  timing: SegmentationTiming;
};

export type SegmentBottleOptions = {
  onProgress?: (progress: RemoveBackgroundProgress) => void;
  /** pending のうちに不要になったら取り消す（実行中の推論は止められないので結果を捨てる） */
  signal?: AbortSignal;
};

type SessionTiming = Pick<CutoutTiming, "modelDownloadMs" | "ortLoadMs" | "sessionCreateMs">;

type LoadedSession = { session: InferenceSession; timing: SessionTiming };

let sessionPromise: Promise<LoadedSession> | null = null;
let sessionReady = false;

/** 推論は端末内で 1 本ずつ。pending は最新 1 件（Issue #48 A-2 / A-3 / 8） */
const scheduler = createLatestOnlyScheduler();

export function getCutoutSchedulerStats(): { started: number; superseded: number } {
  return scheduler.stats;
}

/**
 * SIMD が無い端末ではトグル非表示。モデル本体は使ったときだけ読む。
 * @imgly/background-removal は AGPL-3.0 のため使わない（仕様の Apache-2.0 前提）。
 */
export function supportsBackgroundRemoval(): boolean {
  return typeof WebAssembly !== "undefined" && supportsWasmSimd();
}

/**
 * 未補正の 2:3 キャンバスから被写体マスクを求める。失敗はすべて `CutoutError`。
 * 成功時のマスクは cleanup と品質判定を通っている。
 */
export async function segmentBottle(
  input: HTMLCanvasElement,
  options: SegmentBottleOptions = {},
): Promise<BottleSegmentation> {
  if (!supportsBackgroundRemoval()) {
    throw new CutoutError("unsupported");
  }
  const timing: SegmentationTiming = emptyCutoutTiming();
  const modelSize = PHOTO_CUTOUT_MODEL_SIZE;

  const preprocessStart = performance.now();
  const modelCanvas = resizeToModel(input, modelSize);
  const modelCtx = modelCanvas.getContext("2d");
  if (!modelCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const packed = packU2NetTensor(modelCtx.getImageData(0, 0, modelSize, modelSize).data);
  timing.preprocessMs = elapsed(preprocessStart);

  const loaded = await getSession(options.onProgress);
  timing.modelDownloadMs = loaded.timing.modelDownloadMs;
  timing.ortLoadMs = loaded.timing.ortLoadMs;
  timing.sessionCreateMs = loaded.timing.sessionCreateMs;
  const { session } = loaded;
  const ort = await loadOrt();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new CutoutError("invalid_output", "model io names");
  }

  const results = await scheduler.schedule(
    async (context) => {
      timing.queueWaitMs = context.queueWaitMs;
      const inferenceStart = performance.now();
      const run = session.run({
        [inputName]: new ort.Tensor("float32", packed, [1, 3, modelSize, modelSize]),
      });
      // タイムアウトで呼び出し元へ返しても `run` は続くので、終わるまで枠を渡さない
      context.hold(run);
      try {
        return await raceWithTimeout(run, PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS);
      } catch (error) {
        throw error instanceof CutoutError
          ? error
          : new CutoutError("inference", undefined, { cause: error });
      } finally {
        timing.inferenceMs = elapsed(inferenceStart);
      }
    },
    { signal: options.signal },
  );

  const postStart = performance.now();
  const output = results[outputName];
  if (!output || !(output.data instanceof Float32Array)) {
    throw new CutoutError("invalid_output", "output tensor");
  }
  let flat: Float32Array;
  try {
    flat = flattenMaskOutput(output.data, modelSize);
  } catch (error) {
    throw new CutoutError("invalid_output", "mask shape", { cause: error });
  }
  const refined = refineBottleMask(normalizeU2NetMask(flat), modelSize, modelSize);
  timing.postprocessMs = elapsed(postStart);
  if (!refined.validation.ok) {
    throw new CutoutError(refined.validation.reason, refined.validation.detail);
  }
  return { mask: refined.mask, modelSize, features: refined.validation.features, timing };
}

/**
 * マスクを元画像へ当て、色補正（周辺減光なし）→ 2:3 キャンバスへ下端揃え + 落ち影で置く。
 * 推論とは独立なので、キャッシュしたマスクから何度でも作れる。
 */
export function composeBottleCutout(input: {
  source: HTMLCanvasElement;
  mask: Uint8Array;
  modelSize: number;
  preset: ColorPreset;
  output: { width: number; height: number };
}): HTMLCanvasElement {
  const scaled = scaleMask(input.mask, input.modelSize, input.source.width, input.source.height);
  const cut = document.createElement("canvas");
  cut.width = input.source.width;
  cut.height = input.source.height;
  const cutCtx = cut.getContext("2d");
  if (!cutCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  cutCtx.drawImage(input.source, 0, 0);
  const image = cutCtx.getImageData(0, 0, cut.width, cut.height);
  applyAlphaMask(image.data, scaled);
  cutCtx.putImageData(image, 0, 0);
  const colored = applyPreset(cut, input.preset, { vignette: false });
  const dest = document.createElement("canvas");
  dest.width = input.output.width;
  dest.height = input.output.height;
  paintCutoutOnCanvas(colored, dest);
  return dest;
}

function paintCutoutOnCanvas(cutout: HTMLCanvasElement, dest: HTMLCanvasElement): void {
  const srcCtx = cutout.getContext("2d");
  const destCtx = dest.getContext("2d");
  if (!srcCtx || !destCtx) {
    throw new CutoutError("unsupported", "canvas 2d");
  }
  const image = srcCtx.getImageData(0, 0, cutout.width, cutout.height);
  const box = alphaBoundingBox(
    image.data,
    cutout.width,
    cutout.height,
    PHOTO_CUTOUT_MASK.bboxAlpha,
  ) ?? {
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

async function getSession(
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<LoadedSession> {
  if (sessionReady && sessionPromise) {
    const loaded = await sessionPromise;
    return {
      session: loaded.session,
      timing: { modelDownloadMs: 0, ortLoadMs: 0, sessionCreateMs: 0 },
    };
  }
  if (!sessionPromise) {
    sessionPromise = createSession(onProgress).then(
      (loaded) => {
        sessionReady = true;
        return loaded;
      },
      (error: unknown) => {
        sessionPromise = null;
        throw error;
      },
    );
  }
  return sessionPromise;
}

async function createSession(
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<LoadedSession> {
  const timing: SessionTiming = emptyCutoutTiming();
  const ortStart = performance.now();
  const ort = await loadOrt().catch((error: unknown) => {
    throw new CutoutError("session_init", "ort load", { cause: error });
  });
  timing.ortLoadMs = elapsed(ortStart);

  const downloadStart = performance.now();
  const bytes = await loadCutoutModelBytes(onProgress).catch((error: unknown) => {
    throw error instanceof CutoutError
      ? error
      : new CutoutError("model_download", undefined, { cause: error });
  });
  timing.modelDownloadMs = elapsed(downloadStart);

  const createStart = performance.now();
  try {
    const session = await raceWithTimeout(
      ort.InferenceSession.create(bytes),
      PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
    );
    timing.sessionCreateMs = elapsed(createStart);
    return { session, timing };
  } catch (error) {
    throw error instanceof CutoutError
      ? error
      : new CutoutError("session_init", undefined, { cause: error });
  }
}

/**
 * onnxruntime-web 1.21.0 の `ort.wasm.bundle.min.mjs` は WASM 用 JS を内蔵していない。
 * `importWasmModule` は常に `ort-wasm-simd-threaded.mjs` を dynamic import する。
 * `.wasm` だけ渡すと glue の URL がバンドル JS の隣（`/assets/…mjs`）になり、
 * SPA fallback の HTML を読んで初期化に失敗する。`.mjs` と `.wasm` を同一オリジンへ明示する。
 */
export function resolveOrtWasmPaths(origin = ""): { mjs: string; wasm: string } {
  const prefix = origin.replace(/\/$/, "");
  const directory = `${prefix}${PHOTO_CUTOUT_ORT_WASM_PATH}`;
  return {
    mjs: `${directory}${PHOTO_CUTOUT_ORT_MJS_FILE}`,
    wasm: `${directory}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
  };
}

async function loadOrt(): Promise<typeof import("onnxruntime-web")> {
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = resolveOrtWasmPaths(globalThis.location?.origin ?? "");
  // マルチスレッドは crossOriginIsolated（COOP / COEP）が前提で、現状の配信ヘッダーでは使えない。
  // 1 固定は意図的。解除は COOP / COEP の影響調査（別 Issue）を通してから
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  return ort;
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
