import {
  PHOTO_CUTOUT_MASK_CACHE_SIZE,
  PHOTO_RECOGNIZE_LONG_EDGE,
  type PhotoMascotPose,
} from "@/shared/constants.ts";
import { composeMascot } from "./compose-mascot.ts";
import { cropResize } from "./crop-resize.ts";
import { createSharedSegmentation } from "./cutout-cache.ts";
import {
  CutoutError,
  type CutoutFailureReason,
  type CutoutOutcome,
  type CutoutTiming,
  cutoutFailureFields,
  emptyCutoutTiming,
} from "./cutout-result.ts";
import { encodeCutoutBlob } from "./encode-cutout.ts";
import {
  type AspectRatio,
  aspectForKind,
  computeCoverCrop,
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

export type CutoutPreview =
  | { status: "success"; canvas: HTMLCanvasElement; cached: boolean; timing: CutoutTiming }
  | { status: "failed"; reason: CutoutFailureReason; detail?: string };

type PreparedPhoto = {
  aspect: AspectRatio;
  output: OutputSize;
  /** トリミング・リサイズ済み。色補正はしない */
  cropped: HTMLCanvasElement;
  /** 背景除去の同一性キー（画像・比率・位置・拡縮） */
  segmentationKey: string;
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
  const aspect = aspectForKind(params.kind);
  return [
    sourceIdentity(params.source),
    params.kind,
    `${aspect.width}:${aspect.height}`,
    params.scale.toFixed(4),
    params.offsetX.toFixed(4),
    params.offsetY.toFixed(4),
  ].join("|");
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

/** 切り抜く前の 2:3 JPEG（ラベル読み取り用。保存しない） */
export async function prepareRecognitionImage(prepared: PreparedPhoto): Promise<Blob> {
  return toJpegBlob(prepared.cropped);
}

const segmentation = createSharedSegmentation<
  { cropped: HTMLCanvasElement; onProgress?: (progress: RemoveBackgroundProgress) => void },
  BottleSegmentation
>({
  limit: PHOTO_CUTOUT_MASK_CACHE_SIZE,
  run: (input, { signal }) =>
    segmentBottle(input.cropped, { onProgress: input.onProgress, signal }),
});

/** テスト・デバッグ用。編集画面を閉じても呼ばない（再編集で再利用するため。上限で自然に捨てる） */
export function clearSegmentationCache(): void {
  segmentation.clear();
}

async function segmentPrepared(
  prepared: PreparedPhoto,
  options: { onProgress?: (progress: RemoveBackgroundProgress) => void; signal?: AbortSignal },
): Promise<{ segmentation: BottleSegmentation; cached: boolean }> {
  const result = await segmentation.request(
    prepared.segmentationKey,
    { cropped: prepared.cropped, onProgress: options.onProgress },
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
  const prepared = preparePhoto(input);
  try {
    const { segmentation: seg, cached } = await segmentPrepared(prepared, {
      onProgress: input.onCutoutProgress,
      signal: input.signal,
    });
    const composeStart = performance.now();
    const canvas = composeBottleCutout({
      source: prepared.cropped,
      mask: seg.mask,
      modelSize: seg.modelSize,
      output: prepared.output,
    });
    const composeMs = Math.round(performance.now() - composeStart);
    const timing = timingFrom(seg, cached, {
      composeMs,
      encodeMs: 0,
      totalMs: Math.round(performance.now() - started),
    });
    recordCutoutMetric("preview", { status: "success", cached, timing });
    return { status: "success", canvas, cached, timing };
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
  const blob = await toJpegBlob(canvas);
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
    const blob = await toJpegBlob(prepared.cropped);
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
    const result = await segmentPrepared(prepared, { onProgress: input.onCutoutProgress });
    seg = result.segmentation;
    cached = result.cached;
    const composeStart = performance.now();
    const dest = composeBottleCutout({
      source: prepared.cropped,
      mask: seg.mask,
      modelSize: seg.modelSize,
      output: prepared.output,
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
