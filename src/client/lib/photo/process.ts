import {
  PHOTO_CUTOUT_MASK_CACHE_MAX_BYTES,
  PHOTO_CUTOUT_MASK_CACHE_SIZE,
  PHOTO_RECOGNIZE_LONG_EDGE,
  type PhotoMascotPose,
} from "@/shared/constants.ts";
import { composeMascot } from "./compose-mascot.ts";
import { cropResize } from "./crop-resize.ts";
import { createSharedSegmentation } from "./cutout-cache.ts";
import { isCutoutCompareMode, resolveCutoutProviderPreference } from "./cutout-provider.ts";
import {
  CutoutError,
  type CutoutFailureReason,
  type CutoutOutcome,
  type CutoutTiming,
  cutoutFailureFields,
  emptyCutoutTiming,
} from "./cutout-result.ts";
import {
  computeInferenceRoi,
  inferenceKeyParts,
  normalizeRoi,
  roiFromNormalized,
  workImageSize,
} from "./cutout-roi.ts";
import type { CutoutQueuePolicy } from "./cutout-scheduler.ts";
import { decodeImage } from "./decode-image.ts";
import { encodeCutoutBlob } from "./encode-cutout.ts";
import {
  type AspectRatio,
  aspectForKind,
  computeCoverCrop,
  type CropRect,
  fitToLongEdge,
  type OutputSize,
  outputSizeForAspect,
  resizeKeepAspect,
} from "./geometry.ts";
import { recordCutoutMetric } from "./photo-metrics.ts";
import {
  type BottleSegmentation,
  composeBottleCutout,
  type RemoveBackgroundProgress,
  segmentBottle,
  supportsBackgroundRemoval,
} from "./remove-background.ts";
import { toJpegBlob, toJpegBlobWithinLimit } from "./to-jpeg-blob.ts";

export type PhotoProcessKind = "log" | "cellar" | "note";

export type PhotoEditParams = {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  kind: PhotoProcessKind;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ProcessPhotoInput = PhotoEditParams & {
  mascotOn: boolean;
  mascotPose?: PhotoMascotPose;
  cutoutOn: boolean;
  onCutoutProgress?: (progress: RemoveBackgroundProgress) => void;
  /**
   * セラーのみ。切り抜く前の 2:3 JPEG ができた時点で呼ぶ。
   * 背景除去を待たずにラベル読み取りを始めるための口（Issue #48 D-1）
   */
  onRecognizeJpeg?: (jpeg: Blob) => void;
  /** 保存・バッチは fifo。省略時はプレビュー向け latest */
  cutoutQueue?: CutoutQueuePolicy;
  /** 手動角度。未指定なら自動補正角。推論は再実行しない */
  rotationDegrees?: number;
};

/**
 * 認識用 JPEG。表示用より小さい長辺（`PHOTO_RECOGNIZE_LONG_EDGE`）に落として
 * 入力トークンと転送量を減らす（spec/features/ai-recognition.md 9）。既に小さければそのまま
 */
export function toRecognizeJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  const size = fitToLongEdge(canvas.width, canvas.height, PHOTO_RECOGNIZE_LONG_EDGE);
  const source =
    size.width === canvas.width && size.height === canvas.height
      ? canvas
      : resizeKeepAspect(canvas, canvas.width, canvas.height, size);
  return toJpegBlobWithinLimit(source);
}

/** 保存済み表面（WebP 切り抜き含む）を recognize 用 JPEG にする。API は JPEG 以外 415 */
export async function toRecognizeJpegFromBlob(blob: Blob): Promise<Blob> {
  const bitmap = await decodeImage(blob);
  try {
    const size = fitToLongEdge(bitmap.width, bitmap.height, PHOTO_RECOGNIZE_LONG_EDGE);
    const canvas = resizeKeepAspect(bitmap, bitmap.width, bitmap.height, size);
    return toJpegBlobWithinLimit(canvas);
  } finally {
    bitmap.close();
  }
}

export type ProcessedPhoto = {
  blob: Blob;
  previewUrl: string;
  recognizeJpeg?: Blob;
  /** JPEG EXIF または File.lastModified から取った撮影時刻（ISO） */
  capturedAt?: string;
  /** セラーのみ。切り抜きの成否と理由・工程時間 */
  cutout?: CutoutOutcome;
};

export type PreviewCutoutInput = PhotoEditParams & {
  onCutoutProgress?: (progress: RemoveBackgroundProgress) => void;
  signal?: AbortSignal;
};

export type CutoutComposeAssets = {
  work: HTMLCanvasElement;
  roi: CropRect;
  mask: Uint8Array;
  modelSize: number;
  output: OutputSize;
  autoAngle: number;
};

export type CutoutPreview =
  | {
      status: "success";
      canvas: HTMLCanvasElement;
      cached: boolean;
      timing: CutoutTiming;
      autoAngle: number;
      rotationDegrees: number;
      assets: CutoutComposeAssets;
    }
  | { status: "failed"; reason: CutoutFailureReason; detail?: string };

type PreparedPhoto = {
  aspect: AspectRatio;
  output: OutputSize;
  /** 棚用 2:3 またはノート用 4:5。認識 JPEG と切り抜き OFF 用 */
  cropped: HTMLCanvasElement;
  /** 背景除去の同一性キー（画像・ROI・モデル・前処理版。角度は含めない） */
  segmentationKey: string;
};

type PreparedCutout = PreparedPhoto & {
  work: HTMLCanvasElement;
  inferenceRoi: CropRect;
};

/** 画像オブジェクトの同一性。Blob URL ではなくオブジェクトそのものを使い、GC を妨げない */
const sourceIds = new WeakMap<object, number>();
let nextSourceId = 1;

function sourceIdentity(source: CanvasImageSource): number {
  let id = sourceIds.get(source);
  if (id === undefined) {
    id = nextSourceId;
    nextSourceId += 1;
    sourceIds.set(source, id);
  }
  return id;
}

export function segmentationKeyFor(params: PhotoEditParams): string {
  const roi = computeInferenceRoi({
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    scale: params.scale,
    offsetX: params.offsetX,
    offsetY: params.offsetY,
  });
  return inferenceKeyParts({
    sourceId: sourceIdentity(params.source),
    roi: normalizeRoi(roi, params.sourceWidth, params.sourceHeight),
    compareProvider: isCutoutCompareMode() ? resolveCutoutProviderPreference() : undefined,
  });
}

/** 向き補正済みの元画像から、比率・位置・拡縮を確定する */
export function preparePhoto(params: PhotoEditParams): PreparedPhoto {
  const aspect = aspectForKind(params.kind);
  const crop = computeCoverCrop({
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    aspect,
    scale: params.scale,
    offsetX: params.offsetX,
    offsetY: params.offsetY,
  });
  const output = outputSizeForAspect(aspect);
  return {
    aspect,
    output,
    cropped: cropResize(params.source, crop, output),
    segmentationKey: segmentationKeyFor(params),
  };
}

function prepareCutoutWork(params: PhotoEditParams, prepared: PreparedPhoto): PreparedCutout {
  const size = workImageSize(params.sourceWidth, params.sourceHeight);
  const work = resizeKeepAspect(params.source, params.sourceWidth, params.sourceHeight, size);
  const sourceRoi = computeInferenceRoi({
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    scale: params.scale,
    offsetX: params.offsetX,
    offsetY: params.offsetY,
  });
  const inferenceRoi = roiFromNormalized(
    normalizeRoi(sourceRoi, params.sourceWidth, params.sourceHeight),
    work.width,
    work.height,
  );
  return { ...prepared, work, inferenceRoi };
}

function roiCanvasFrom(prepared: PreparedCutout): HTMLCanvasElement {
  return cropResize(prepared.work, prepared.inferenceRoi, {
    width: Math.max(1, Math.round(prepared.inferenceRoi.sw)),
    height: Math.max(1, Math.round(prepared.inferenceRoi.sh)),
  });
}

/** 切り抜く前の 2:3 JPEG（ラベル読み取り用。保存しない） */
export async function prepareRecognitionImage(prepared: PreparedPhoto): Promise<Blob> {
  return toJpegBlob(prepared.cropped);
}

const segmentation = createSharedSegmentation<
  {
    roiCanvas: HTMLCanvasElement;
    onProgress?: (progress: RemoveBackgroundProgress) => void;
    queue?: CutoutQueuePolicy;
  },
  BottleSegmentation
>({
  limit: PHOTO_CUTOUT_MASK_CACHE_SIZE,
  maxBytes: PHOTO_CUTOUT_MASK_CACHE_MAX_BYTES,
  sizeOf: (value) => value.mask.byteLength,
  run: (input, { signal }) =>
    segmentBottle(input.roiCanvas, {
      onProgress: input.onProgress,
      signal,
      queue: input.queue,
    }),
});

/** テスト・デバッグ用。編集画面を閉じても呼ばない（再編集で再利用するため。上限で自然に捨てる） */
export function clearSegmentationCache(): void {
  segmentation.clear();
}

/** 同じ RGB / マスクを角度だけ変えて合成する。推論しない */
export function composeCutoutPreview(
  assets: CutoutComposeAssets,
  rotationDegrees: number,
): HTMLCanvasElement {
  return composeBottleCutout({
    source: assets.work,
    roi: assets.roi,
    mask: assets.mask,
    modelSize: assets.modelSize,
    output: assets.output,
    rotationDegrees,
  });
}

async function segmentPrepared(
  prepared: PreparedCutout,
  options: {
    onProgress?: (progress: RemoveBackgroundProgress) => void;
    signal?: AbortSignal;
    queue?: CutoutQueuePolicy;
  },
): Promise<{ segmentation: BottleSegmentation; cached: boolean }> {
  const result = await segmentation.request(
    prepared.segmentationKey,
    {
      roiCanvas: roiCanvasFrom(prepared),
      onProgress: options.onProgress,
      queue: options.queue,
    },
    { signal: options.signal },
  );
  return { segmentation: result.value, cached: result.cached };
}

function timingFrom(
  seg: BottleSegmentation | null,
  cached: boolean,
  extra: { composeMs: number; encodeMs: number; totalMs: number },
): CutoutTiming {
  const base = emptyCutoutTiming();
  if (seg && !cached) {
    Object.assign(base, seg.timing);
  } else if (seg) {
    base.provider = seg.provider;
    base.fallback = seg.fallback;
  }
  base.postprocessMs += extra.composeMs;
  base.encodeMs = extra.encodeMs;
  base.totalMs = extra.totalMs;
  return base;
}

/**
 * 編集画面のプレビュー。推論は同一キーで 1 回、結果は「使う」で再利用される。
 * 中断（`signal`）は pending の取り消しと結果の破棄だけで、走っている推論の結果はキャッシュに残す。
 */
export async function previewCutout(input: PreviewCutoutInput): Promise<CutoutPreview> {
  const started = performance.now();
  if (!supportsBackgroundRemoval()) {
    return { status: "failed", reason: "unsupported" };
  }
  const prepared = prepareCutoutWork(input, preparePhoto(input));
  try {
    const { segmentation: seg, cached } = await segmentPrepared(prepared, {
      onProgress: input.onCutoutProgress,
      signal: input.signal,
      queue: "latest",
    });
    const rotationDegrees = seg.upright.correctionDegrees;
    const composeStart = performance.now();
    const canvas = composeBottleCutout({
      source: prepared.work,
      roi: prepared.inferenceRoi,
      mask: seg.mask,
      modelSize: seg.modelSize,
      output: prepared.output,
      rotationDegrees,
    });
    const composeMs = Math.round(performance.now() - composeStart);
    const timing = timingFrom(seg, cached, {
      composeMs,
      encodeMs: 0,
      totalMs: Math.round(performance.now() - started),
    });
    const assets: CutoutComposeAssets = {
      work: prepared.work,
      roi: prepared.inferenceRoi,
      mask: seg.mask,
      modelSize: seg.modelSize,
      output: prepared.output,
      autoAngle: rotationDegrees,
    };
    recordCutoutMetric("preview", {
      status: "success",
      cached,
      timing,
      autoAngle: rotationDegrees,
      rotationDegrees,
    });
    return { status: "success", canvas, cached, timing, autoAngle: rotationDegrees, rotationDegrees, assets };
  } catch (error) {
    const fields = cutoutFailureFields(error);
    if (fields.reason !== "superseded") {
      recordCutoutMetric("preview", {
        status: "failed",
        ...fields,
        timing: timingFrom(null, false, {
          composeMs: 0,
          encodeMs: 0,
          totalMs: Math.round(performance.now() - started),
        }),
      });
    }
    return { status: "failed", ...fields };
  }
}

export async function processLogPhoto(input: {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  mascotOn: boolean;
  mascotPose?: PhotoMascotPose;
  capturedAt?: string;
  onRecognizeJpeg?: (jpeg: Blob) => void;
}): Promise<ProcessedPhoto> {
  const output = fitToLongEdge(input.sourceWidth, input.sourceHeight);
  const full = resizeKeepAspect(input.source, input.sourceWidth, input.sourceHeight, output);
  const recognizeJpeg = await toRecognizeJpeg(full);
  input.onRecognizeJpeg?.(recognizeJpeg);
  let canvas = full;
  if (input.mascotOn) {
    canvas = await composeMascot(full, input.mascotPose);
  }
  const blob = await toJpegBlobWithinLimit(canvas);
  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    recognizeJpeg,
    capturedAt: input.capturedAt,
  };
}

export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessedPhoto> {
  if (input.kind === "log") {
    return processLogPhoto({
      source: input.source,
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
      mascotOn: input.mascotOn,
      mascotPose: input.mascotPose,
      onRecognizeJpeg: input.onRecognizeJpeg,
    });
  }

  const prepared = preparePhoto(input);

  if (input.kind === "cellar") {
    return processCellarPhoto(input, prepared);
  }

  const recognizeJpeg = await toRecognizeJpeg(prepared.cropped);
  input.onRecognizeJpeg?.(recognizeJpeg);
  let canvas = prepared.cropped;
  if (input.mascotOn) {
    canvas = await composeMascot(canvas, input.mascotPose);
  }
  const blob = await toJpegBlobWithinLimit(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg };
}

async function processCellarPhoto(
  input: ProcessPhotoInput,
  prepared: PreparedPhoto,
): Promise<ProcessedPhoto> {
  const started = performance.now();
  const recognizeJpeg = await toRecognizeJpeg(prepared.cropped);
  input.onRecognizeJpeg?.(recognizeJpeg);

  const fallback = async (cutout: CutoutOutcome): Promise<ProcessedPhoto> => {
    const blob = await toJpegBlobWithinLimit(prepared.cropped);
    return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg, cutout };
  };

  if (!input.cutoutOn) {
    return fallback({ status: "skipped", reason: "off" });
  }
  if (!supportsBackgroundRemoval()) {
    return fallback({ status: "skipped", reason: "unsupported" });
  }

  let seg: BottleSegmentation | null = null;
  let cached = false;
  let composeMs = 0;
  let encodeMs = 0;
  try {
    const cutoutPrepared = prepareCutoutWork(input, prepared);
    const result = await segmentPrepared(cutoutPrepared, {
      onProgress: input.onCutoutProgress,
      queue: input.cutoutQueue ?? "fifo",
    });
    seg = result.segmentation;
    cached = result.cached;
    const rotationDegrees = input.rotationDegrees ?? seg.upright.correctionDegrees;
    const composeStart = performance.now();
    const dest = composeBottleCutout({
      source: cutoutPrepared.work,
      roi: cutoutPrepared.inferenceRoi,
      mask: seg.mask,
      modelSize: seg.modelSize,
      output: prepared.output,
      rotationDegrees,
    });
    composeMs = Math.round(performance.now() - composeStart);
    const encodeStart = performance.now();
    const blob = await encodeCutoutBlob(dest).catch((error: unknown) => {
      throw error instanceof CutoutError
        ? error
        : new CutoutError("encode", undefined, { cause: error });
    });
    encodeMs = Math.round(performance.now() - encodeStart);
    const cutout: CutoutOutcome = {
      status: "success",
      cached,
      autoAngle: seg.upright.correctionDegrees,
      rotationDegrees,
      timing: timingFrom(seg, cached, {
        composeMs,
        encodeMs,
        totalMs: Math.round(performance.now() - started),
      }),
    };
    recordCutoutMetric("save", cutout);
    return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg, cutout };
  } catch (error) {
    const cutout: CutoutOutcome = {
      status: "failed",
      ...cutoutFailureFields(error),
      timing: timingFrom(seg, cached, {
        composeMs,
        encodeMs,
        totalMs: Math.round(performance.now() - started),
      }),
    };
    recordCutoutMetric("save", cutout);
    return fallback(cutout);
  }
}
