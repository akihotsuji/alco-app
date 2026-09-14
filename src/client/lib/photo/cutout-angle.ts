import {
  PHOTO_CUTOUT_ANGLE_MAX,
  PHOTO_CUTOUT_ANGLE_MIN,
  PHOTO_CUTOUT_ANGLE_SAMPLE_EDGE,
  PHOTO_CUTOUT_MASK,
  PHOTO_CUTOUT_UPRIGHT,
} from "@/shared/constants.ts";
import type { BottleMaskFeatures } from "./cutout-quality.ts";

export type UprightDecision = {
  /** 現在の傾き（度）。正は時計回り（y 下向き） */
  tiltDegrees: number;
  /** 適用する逆回転。自動補正しないときは 0 */
  correctionDegrees: number;
  applied: boolean;
  reason:
    | "applied"
    | "upright"
    | "too_tilted"
    | "landscape"
    | "round"
    | "multiple"
    | "clipped"
    | "noisy"
    | "unstable"
    | "empty";
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wrapAngleDegrees(value: number): number {
  const span = PHOTO_CUTOUT_ANGLE_MAX - PHOTO_CUTOUT_ANGLE_MIN;
  let wrapped =
    ((((value - PHOTO_CUTOUT_ANGLE_MIN) % span) + span) % span) + PHOTO_CUTOUT_ANGLE_MIN;
  if (wrapped === PHOTO_CUTOUT_ANGLE_MIN) {
    wrapped = PHOTO_CUTOUT_ANGLE_MAX;
  }
  return wrapped;
}

export function clampAngleDegrees(value: number): number {
  return clamp(Math.round(value), PHOTO_CUTOUT_ANGLE_MIN, PHOTO_CUTOUT_ANGLE_MAX);
}

export function stepAngleDegrees(value: number, delta: number): number {
  return clampAngleDegrees(value + delta);
}

/** 正方形モデル空間のマスクを元領域の縦横比へ戻す（stretch の逆） */
export function restoreMaskAspect(
  mask: Uint8Array,
  modelSize: number,
  width: number,
  height: number,
): Uint8Array {
  if (width === modelSize && height === modelSize) {
    return mask;
  }
  const out = new Uint8Array(width * height);
  const scaleX = modelSize / width;
  const scaleY = modelSize / height;
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(modelSize - 1, Math.floor(y * scaleY));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(modelSize - 1, Math.floor(x * scaleX));
      out[y * width + x] = mask[srcY * modelSize + srcX] ?? 0;
    }
  }
  return out;
}

export function downscaleMask(
  mask: Uint8Array,
  width: number,
  height: number,
  maxEdge: number,
): { mask: Uint8Array; width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { mask, width, height };
  }
  const scale = maxEdge / longEdge;
  const nextW = Math.max(1, Math.round(width * scale));
  const nextH = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(nextW * nextH);
  for (let y = 0; y < nextH; y += 1) {
    const srcY = Math.min(height - 1, Math.floor((y * height) / nextH));
    for (let x = 0; x < nextW; x += 1) {
      const srcX = Math.min(width - 1, Math.floor((x * width) / nextW));
      out[y * nextW + x] = mask[srcY * width + srcX] ?? 0;
    }
  }
  return { mask: out, width: nextW, height: nextH };
}

function eigen2x2(cxx: number, cxy: number, cyy: number): { major: number; minor: number } {
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.sqrt(Math.max(0, trace * trace - 4 * det));
  const first = (trace + disc) / 2;
  const second = (trace - disc) / 2;
  return {
    major: Math.max(first, second),
    minor: Math.max(1e-12, Math.min(first, second)),
  };
}

/** 長軸の +x からの角度（ラジアン）。180° の向きは区別しない */
export function majorAxisAngleFromX(cxx: number, cxy: number, cyy: number): number {
  const { major } = eigen2x2(cxx, cxy, cyy);
  let vx = cxy;
  let vy = major - cxx;
  if (Math.abs(vx) + Math.abs(vy) < 1e-12) {
    vx = major - cyy;
    vy = cxy;
  }
  if (Math.abs(vx) + Math.abs(vy) < 1e-12) {
    return cxx >= cyy ? 0 : Math.PI / 2;
  }
  return Math.atan2(vy, vx);
}

/** 長軸と鉛直の差を [-90, 90] に畳む。上下は保証しない */
export function tiltFromVerticalDegrees(axisFromX: number): number {
  let tilt = axisFromX - Math.PI / 2;
  while (tilt > Math.PI / 2) {
    tilt -= Math.PI;
  }
  while (tilt < -Math.PI / 2) {
    tilt += Math.PI;
  }
  return (tilt * 180) / Math.PI;
}

function pcaTilt(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): {
  tilt: number;
  count: number;
  elongation: number;
} | null {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) < threshold) {
        continue;
      }
      count += 1;
      sumX += x;
      sumY += y;
    }
  }
  if (count < PHOTO_CUTOUT_UPRIGHT.minSamplePixels) {
    return null;
  }
  const cx = sumX / count;
  const cy = sumY / count;
  let cxx = 0;
  let cxy = 0;
  let cyy = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) < threshold) {
        continue;
      }
      const dx = x - cx;
      const dy = y - cy;
      cxx += dx * dx;
      cxy += dx * dy;
      cyy += dy * dy;
    }
  }
  cxx /= count;
  cxy /= count;
  cyy /= count;
  const { major, minor } = eigen2x2(cxx, cxy, cyy);
  return {
    tilt: tiltFromVerticalDegrees(majorAxisAngleFromX(cxx, cxy, cyy)),
    count,
    elongation: major / minor,
  };
}

function pcaTiltRegion(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  y0: number,
  y1: number,
): number | null {
  const region = new Uint8Array(mask.length);
  for (let y = y0; y < y1; y += 1) {
    region.set(mask.subarray(y * width, y * width + width), y * width);
  }
  return pcaTilt(region, width, height, threshold)?.tilt ?? null;
}

/** 上下半分の PCA が食い違うときは軸が安定していない */
export function splitHalfTiltDegrees(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): { top: number; bottom: number } | null {
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) >= threshold) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxY < 0 || maxY - minY < 8) {
    return null;
  }
  const mid = Math.floor((minY + maxY) / 2);
  const top = pcaTiltRegion(mask, width, height, threshold, minY, mid + 1);
  const bottom = pcaTiltRegion(mask, width, height, threshold, mid, maxY + 1);
  if (top === null || bottom === null) {
    return null;
  }
  return { top, bottom };
}

function clippedSideCount(features: BottleMaskFeatures): number {
  const limit = PHOTO_CUTOUT_UPRIGHT.maxBorderContact;
  return (
    Number(features.borderContact.left >= limit) +
    Number(features.borderContact.right >= limit) +
    Number(features.borderContact.top >= limit) +
    Number(features.borderContact.bottom >= limit)
  );
}

/**
 * 元画像の縦横比へ戻したマスクから傾きを推定する。
 * 適用するのは逆回転。180° 反転は自動では行わない。
 */
export function estimateBottleUpright(input: {
  mask: Uint8Array;
  width: number;
  height: number;
  features: BottleMaskFeatures;
}): UprightDecision {
  const none = (reason: UprightDecision["reason"], tilt = 0): UprightDecision => ({
    tiltDegrees: tilt,
    correctionDegrees: 0,
    applied: false,
    reason,
  });

  if (input.features.foregroundRatio < PHOTO_CUTOUT_MASK.minForegroundRatio) {
    return none("empty");
  }
  if (input.features.foregroundRatio > PHOTO_CUTOUT_UPRIGHT.maxForegroundRatio) {
    return none("noisy");
  }
  if (input.features.largestComponentRatio < PHOTO_CUTOUT_UPRIGHT.minLargestComponent) {
    return none("multiple");
  }
  if (clippedSideCount(input.features) > PHOTO_CUTOUT_UPRIGHT.maxClippedSides) {
    return none("clipped");
  }

  const sampled = downscaleMask(
    input.mask,
    input.width,
    input.height,
    PHOTO_CUTOUT_ANGLE_SAMPLE_EDGE,
  );
  const threshold = PHOTO_CUTOUT_MASK.subjectAlpha;
  const pca = pcaTilt(sampled.mask, sampled.width, sampled.height, threshold);
  if (!pca) {
    return none("empty");
  }
  if (pca.elongation < PHOTO_CUTOUT_UPRIGHT.minElongation) {
    return none("round", pca.tilt);
  }
  if (input.features.bboxAspect < PHOTO_CUTOUT_UPRIGHT.minBboxAspect) {
    return none("landscape", pca.tilt);
  }
  const halves = splitHalfTiltDegrees(sampled.mask, sampled.width, sampled.height, threshold);
  if (
    halves &&
    Math.abs(halves.top - halves.bottom) > PHOTO_CUTOUT_UPRIGHT.maxAxisDisagreeDegrees
  ) {
    return none("unstable", pca.tilt);
  }

  const tilt = pca.tilt;
  const abs = Math.abs(tilt);
  if (abs < PHOTO_CUTOUT_UPRIGHT.minAutoDegrees) {
    return none("upright", tilt);
  }
  if (abs > PHOTO_CUTOUT_UPRIGHT.maxAutoDegrees) {
    return none("too_tilted", tilt);
  }
  return {
    tiltDegrees: tilt,
    correctionDegrees: clampAngleDegrees(-tilt),
    applied: true,
    reason: "applied",
  };
}
