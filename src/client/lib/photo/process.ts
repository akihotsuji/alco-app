import { PHOTO_CUTOUT_MASK_CACHE_SIZE } from "@/shared/constants.ts";
import { applyPreset, type ColorPreset } from "./apply-preset.ts";
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
import {
  type AspectRatio,
  aspectForKind,
  computeCoverCrop,
  type OutputSize,
  outputSizeForAspect,
} from "./geometry.ts";
import { recordCutoutMetric } from "./photo-metrics.ts";
import {
  type BottleSegmentation,
  composeBottleCutout,
  type RemoveBackgroundProgress,
  segmentBottle,
  supportsBackgroundRemoval,
} from "./remove-background.ts";
import { toJpegBlob, toWebpBlob } from "./to-jpeg-blob.ts";

export type PhotoProcessKind = "log" | "cellar" | "note";

export type PhotoEditParams = {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  kind: PhotoProcessKind;
  scale: number;
  offsetX: number;
  offsetY: number;
  filterOn: boolean;
};

export type ProcessPhotoInput = PhotoEditParams & {
  mascotOn: boolean;
  cutoutOn: boolean;
  onCutoutProgress?: (progress: RemoveBackgroundProgress) => void;
  /**
   * セラーのみ。切り抜く前の 2:3 JPEG ができた時点で呼ぶ。
   * 背景除去を待たずにラベル読み取りを始めるための口（Issue #48 D-1）
   */
  onRecognizeJpeg?: (jpeg: Blob) => void;
};

export type ProcessedPhoto = {
  blob: Blob;
  previewUrl: string;
  recognizeJpeg?: Blob;
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
  /** トリミング・リサイズ済み、未補正 */
  cropped: HTMLCanvasElement;
  preset: ColorPreset;
  /** 背景除去の同一性キー（画像・比率・位置・拡縮。色補正は含めない） */
  segmentationKey: string;
};

export function presetForKind(kind: PhotoProcessKind, filterOn: boolean): ColorPreset {
  if (!filterOn) {
    return "none";
  }
  return kind === "cellar" ? "cellar" : "table";
}

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

/** 向き補正済みの元画像から、比率・位置・拡縮・色補正プリセットを確定する */
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
    preset: presetForKind(params.kind, params.filterOn),
    segmentationKey: segmentationKeyFor(params),
  };
}

/** 切り抜く前の 2:3 JPEG（ラベル読み取り用。保存しない） */
export async function prepareRecognitionImage(prepared: PreparedPhoto): Promise<Blob> {
  return toJpegBlob(applyPreset(prepared.cropped, prepared.preset));
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
      preset: prepared.preset,
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

export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessedPhoto> {
  const prepared = preparePhoto(input);

  if (input.kind === "cellar") {
    return processCellarPhoto(input, prepared);
  }

  let canvas = applyPreset(prepared.cropped, prepared.preset);
  if (input.mascotOn) {
    canvas = await composeMascot(canvas);
  }
  const blob = await toJpegBlob(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob) };
}

async function processCellarPhoto(
  input: ProcessPhotoInput,
  prepared: PreparedPhoto,
): Promise<ProcessedPhoto> {
  const started = performance.now();
  const filtered = applyPreset(prepared.cropped, prepared.preset);
  const recognizeJpeg = await toJpegBlob(filtered);
  input.onRecognizeJpeg?.(recognizeJpeg);

  const fallback = async (cutout: CutoutOutcome): Promise<ProcessedPhoto> => {
    const blob = recognizeJpeg;
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
      preset: prepared.preset,
      output: prepared.output,
    });
    composeMs = Math.round(performance.now() - composeStart);
    const encodeStart = performance.now();
    const blob = await toWebpBlob(dest).catch((error: unknown) => {
      throw new CutoutError("encode", undefined, { cause: error });
    });
    encodeMs = Math.round(performance.now() - encodeStart);
    if (blob.type !== "image/webp") {
      throw new CutoutError("encode", `type=${blob.type || "empty"}`);
    }
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
