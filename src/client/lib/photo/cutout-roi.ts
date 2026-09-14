import {
  PHOTO_ASPECT,
  PHOTO_CUTOUT_COMPARE_KEY,
  PHOTO_CUTOUT_MODEL_SHA256,
  PHOTO_CUTOUT_PREPROCESS_VERSION,
  PHOTO_CUTOUT_WORK_MAX_EDGE,
  PHOTO_CUTOUT_WORK_MAX_PIXELS,
} from "@/shared/constants.ts";
import { computeCoverCrop, type CropRect, type OutputSize } from "./geometry.ts";

export type NormalizedRoi = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 作業画像サイズ。長辺と総画素の両方で制限する */
export function workImageSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge = PHOTO_CUTOUT_WORK_MAX_EDGE,
  maxPixels = PHOTO_CUTOUT_WORK_MAX_PIXELS,
): OutputSize {
  const sourceLong = Math.max(sourceWidth, sourceHeight);
  if (sourceLong <= 0) {
    return { width: 1, height: 1 };
  }
  let width = sourceWidth;
  let height = sourceHeight;
  if (sourceLong > maxEdge) {
    const scale = maxEdge / sourceLong;
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
  }
  const pixels = width * height;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  return { width, height };
}

/**
 * 2:3 の棚枠で首・底を切らない推論 ROI。
 * 入力は EXIF 補正済みの画素空間（decodeImage 後）。scale=1 は元写真全体。
 * 拡大したときだけ、2:3 窓を含む元写真の縦横比の窓に絞る。
 */
export function computeInferenceRoi(input: {
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}): CropRect {
  if (input.sourceWidth <= 0 || input.sourceHeight <= 0) {
    return { sx: 0, sy: 0, sw: 1, sh: 1 };
  }
  if (input.scale <= 1 + 1e-6) {
    return { sx: 0, sy: 0, sw: input.sourceWidth, sh: input.sourceHeight };
  }
  const focus = computeCoverCrop({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    aspect: PHOTO_ASPECT.cellar,
    scale: input.scale,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
  });
  return expandRectToSourceAspect(focus, input.sourceWidth, input.sourceHeight);
}

/** 指定矩形を含み、元画像と同じ縦横比になる最小窓。はみ出しは元画像内へクランプする */
export function expandRectToSourceAspect(
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  const sourceAspect = sourceWidth / sourceHeight;
  const byHeight = { sw: rect.sh * sourceAspect, sh: rect.sh };
  const byWidth = { sw: rect.sw, sh: rect.sw / sourceAspect };
  const heightContains = byHeight.sw + 1e-6 >= rect.sw;
  const widthContains = byWidth.sh + 1e-6 >= rect.sh;
  let sw: number;
  let sh: number;
  if (heightContains && widthContains) {
    if (byHeight.sw * byHeight.sh <= byWidth.sw * byWidth.sh) {
      sw = byHeight.sw;
      sh = byHeight.sh;
    } else {
      sw = byWidth.sw;
      sh = byWidth.sh;
    }
  } else if (heightContains) {
    sw = byHeight.sw;
    sh = byHeight.sh;
  } else {
    sw = byWidth.sw;
    sh = byWidth.sh;
  }
  sw = Math.min(sw, sourceWidth);
  sh = Math.min(sh, sourceHeight);
  const cx = rect.sx + rect.sw / 2;
  const cy = rect.sy + rect.sh / 2;
  const sx = clamp(cx - sw / 2, 0, sourceWidth - sw);
  const sy = clamp(cy - sh / 2, 0, sourceHeight - sh);
  return { sx, sy, sw, sh };
}

export function normalizeRoi(roi: CropRect, sourceWidth: number, sourceHeight: number): NormalizedRoi {
  return {
    x: sourceWidth > 0 ? roi.sx / sourceWidth : 0,
    y: sourceHeight > 0 ? roi.sy / sourceHeight : 0,
    w: sourceWidth > 0 ? roi.sw / sourceWidth : 1,
    h: sourceHeight > 0 ? roi.sh / sourceHeight : 1,
  };
}

export function roiFromNormalized(
  roi: NormalizedRoi,
  width: number,
  height: number,
): CropRect {
  return {
    sx: roi.x * width,
    sy: roi.y * height,
    sw: Math.max(1, roi.w * width),
    sh: Math.max(1, roi.h * height),
  };
}

/** stretch 前処理: 元座標 → 320 正方形。letterbox 余白は使わない */
export function mapSourceToModel(
  x: number,
  y: number,
  roi: CropRect,
  modelSize: number,
): { x: number; y: number } {
  return {
    x: ((x - roi.sx) / roi.sw) * modelSize,
    y: ((y - roi.sy) / roi.sh) * modelSize,
  };
}

export function mapModelToSource(
  x: number,
  y: number,
  roi: CropRect,
  modelSize: number,
): { x: number; y: number } {
  return {
    x: roi.sx + (x / modelSize) * roi.sw,
    y: roi.sy + (y / modelSize) * roi.sh,
  };
}

export function inferenceKeyParts(input: {
  sourceId: number;
  roi: NormalizedRoi;
  compareProvider?: string;
}): string {
  const parts = [
    String(input.sourceId),
    "cellar",
    PHOTO_CUTOUT_PREPROCESS_VERSION,
    PHOTO_CUTOUT_MODEL_SHA256.slice(0, 12),
    input.roi.x.toFixed(4),
    input.roi.y.toFixed(4),
    input.roi.w.toFixed(4),
    input.roi.h.toFixed(4),
  ];
  if (input.compareProvider) {
    parts.push(PHOTO_CUTOUT_COMPARE_KEY, input.compareProvider);
  }
  return parts.join("|");
}
