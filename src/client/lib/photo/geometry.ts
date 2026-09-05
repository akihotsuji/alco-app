import {
  PHOTO_ASPECT,
  PHOTO_CUTOUT_SHADOW,
  PHOTO_MASCOT_ASPECT,
  PHOTO_MASCOT_GLOW_RADIUS_RATIO,
  PHOTO_MASCOT_MARGIN_RATIO,
  PHOTO_MASCOT_SHORT_SIDE_RATIO,
  PHOTO_OUTPUT_LONG_EDGE,
  PHOTO_SCALE_MAX,
  PHOTO_SCALE_MIN,
} from "@/shared/constants.ts";

export type AspectRatio = { width: number; height: number };

export type CropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type OutputSize = {
  width: number;
  height: number;
};

export type MascotLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  glowCx: number;
  glowCy: number;
  glowRadius: number;
};

export type CutoutPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  shadow: { x: number; y: number; rx: number; ry: number };
};

export function clampScale(scale: number): number {
  return Math.min(PHOTO_SCALE_MAX, Math.max(PHOTO_SCALE_MIN, scale));
}

export function outputSizeForAspect(
  aspect: AspectRatio,
  longEdge = PHOTO_OUTPUT_LONG_EDGE,
): OutputSize {
  const ratio = aspect.width / aspect.height;
  if (ratio >= 1) {
    return { width: longEdge, height: Math.round(longEdge / ratio) };
  }
  return { width: Math.round(longEdge * ratio), height: longEdge };
}

/**
 * cover 切り抜き。scale=1 は画像が枠を覆う最大窓、scale を上げると窓を縮小してズーム。
 * offset は正規化 -1..1（余白の範囲でパン）。
 */
export function computeCoverCrop(input: {
  sourceWidth: number;
  sourceHeight: number;
  aspect: AspectRatio;
  scale: number;
  offsetX: number;
  offsetY: number;
}): CropRect {
  const scale = clampScale(input.scale);
  const frameAspect = input.aspect.width / input.aspect.height;
  const sourceAspect = input.sourceWidth / input.sourceHeight;

  let baseW: number;
  let baseH: number;
  if (sourceAspect > frameAspect) {
    baseH = input.sourceHeight;
    baseW = input.sourceHeight * frameAspect;
  } else {
    baseW = input.sourceWidth;
    baseH = input.sourceWidth / frameAspect;
  }

  const sw = baseW / scale;
  const sh = baseH / scale;
  const maxX = Math.max(0, input.sourceWidth - sw);
  const maxY = Math.max(0, input.sourceHeight - sh);
  const sx = maxX / 2 + (input.offsetX * maxX) / 2;
  const sy = maxY / 2 + (input.offsetY * maxY) / 2;

  return {
    sx: clamp(sx, 0, maxX),
    sy: clamp(sy, 0, maxY),
    sw,
    sh,
  };
}

export function computeMascotLayout(photoWidth: number, photoHeight: number): MascotLayout {
  const shortSide = Math.min(photoWidth, photoHeight);
  const height = shortSide * PHOTO_MASCOT_SHORT_SIDE_RATIO;
  const width = (height * PHOTO_MASCOT_ASPECT.width) / PHOTO_MASCOT_ASPECT.height;
  const margin = shortSide * PHOTO_MASCOT_MARGIN_RATIO;
  const x = photoWidth - width - margin;
  const y = photoHeight - height - margin;
  return {
    x,
    y,
    width,
    height,
    glowCx: x + width / 2,
    glowCy: y + height / 2,
    glowRadius: width * PHOTO_MASCOT_GLOW_RADIUS_RATIO,
  };
}

/** 切り抜き結果を 2:3 キャンバスの下端に揃える（4-06 用。2-08 で座標を固定する） */
export function computeCutoutPlacement(input: {
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): CutoutPlacement {
  const scale = Math.min(
    input.canvasWidth / input.sourceWidth,
    input.canvasHeight / input.sourceHeight,
  );
  const width = input.sourceWidth * scale;
  const height = input.sourceHeight * scale;
  const x = (input.canvasWidth - width) / 2;
  const y = input.canvasHeight - height;
  return {
    x,
    y,
    width,
    height,
    shadow: {
      x: input.canvasWidth / 2,
      y: input.canvasHeight - PHOTO_CUTOUT_SHADOW.heightPx / 2,
      rx: (input.canvasWidth * PHOTO_CUTOUT_SHADOW.widthRatio) / 2,
      ry: PHOTO_CUTOUT_SHADOW.heightPx / 2,
    },
  };
}

export function aspectForKind(kind: "log" | "note" | "cellar"): AspectRatio {
  return kind === "cellar" ? PHOTO_ASPECT.cellar : PHOTO_ASPECT.log;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
