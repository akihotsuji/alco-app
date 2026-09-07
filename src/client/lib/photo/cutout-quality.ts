import { PHOTO_CUTOUT_MASK } from "@/shared/constants.ts";

/**
 * U²-Net の出力マスク（0..255、モデル解像度）に対する後処理と、ボトル切り抜きとしての品質判定。
 * すべて純粋関数。閾値は `PHOTO_CUTOUT_MASK`（実機評価で調整する。Issue #48 B-1〜B-3）。
 */

export type MaskCleanupOptions = {
  lowAlpha: number;
  highAlpha: number;
  minComponentRatio: number;
};

export type MaskLimits = {
  minForegroundRatio: number;
  maxForegroundRatio: number;
  maxSideContact: number;
  subjectAlpha: number;
};

export type MaskBox = { x: number; y: number; width: number; height: number };

export type BottleMaskFeatures = {
  width: number;
  height: number;
  /** 被写体画素（alpha ≥ subjectAlpha）の比率 */
  foregroundRatio: number;
  bbox: MaskBox | null;
  bboxWidthRatio: number;
  bboxHeightRatio: number;
  /** 高さ / 幅。ボトルなら > 1 になりやすい（判定には使わず記録のみ） */
  bboxAspect: number;
  /** 被写体の重心（0..1）。記録のみ */
  centerX: number;
  centerY: number;
  /** 各辺の画素のうち被写体の比率 */
  borderContact: { left: number; right: number; top: number; bottom: number };
  /** 背景（≤ lowAlpha）か被写体（≥ highAlpha）と言い切れる画素の比率。低いほどモデルが迷っている */
  dynamicRange: number;
  /** 最大連結成分 / 被写体全体。1 に近いほど 1 本の物体 */
  largestComponentRatio: number;
};

export type MaskValidation =
  | { ok: true; features: BottleMaskFeatures }
  | {
      ok: false;
      reason: "empty_mask" | "invalid_mask";
      detail: string;
      features: BottleMaskFeatures;
    };

const defaultCleanup: MaskCleanupOptions = {
  lowAlpha: PHOTO_CUTOUT_MASK.lowAlpha,
  highAlpha: PHOTO_CUTOUT_MASK.highAlpha,
  minComponentRatio: PHOTO_CUTOUT_MASK.minComponentRatio,
};

const defaultLimits: MaskLimits = {
  minForegroundRatio: PHOTO_CUTOUT_MASK.minForegroundRatio,
  maxForegroundRatio: PHOTO_CUTOUT_MASK.maxForegroundRatio,
  maxSideContact: PHOTO_CUTOUT_MASK.maxSideContact,
  subjectAlpha: PHOTO_CUTOUT_MASK.subjectAlpha,
};

/**
 * 1) 薄い背景残り（≤ lowAlpha）を 0、確かな被写体（≥ highAlpha）を 255 にして間を線形に伸ばす
 * 2) 小さな連結成分（ゴミ）を消す。最大成分は常に残す
 */
export function cleanupMask(
  mask: Uint8Array,
  width: number,
  height: number,
  options: MaskCleanupOptions = defaultCleanup,
): Uint8Array {
  if (mask.length !== width * height) {
    throw new Error("cutout_mask_size");
  }
  const out = new Uint8Array(mask.length);
  const span = Math.max(1, options.highAlpha - options.lowAlpha);
  for (let i = 0; i < mask.length; i += 1) {
    const value = mask[i] ?? 0;
    if (value <= options.lowAlpha) {
      out[i] = 0;
    } else if (value >= options.highAlpha) {
      out[i] = 255;
    } else {
      out[i] = Math.round(((value - options.lowAlpha) / span) * 255);
    }
  }
  const components = labelComponents(out, width, height, 1);
  if (components.areas.length > 1) {
    const total = components.areas.reduce((sum, area) => sum + area, 0);
    const largest = Math.max(...components.areas);
    const keep = components.areas.map(
      (area) => area === largest || area >= total * options.minComponentRatio,
    );
    for (let i = 0; i < out.length; i += 1) {
      const label = components.labels[i] ?? 0;
      if (label > 0 && !keep[label - 1]) {
        out[i] = 0;
      }
    }
  }
  return out;
}

export function measureBottleMask(
  mask: Uint8Array,
  width: number,
  height: number,
  options: { subjectAlpha?: number; lowAlpha?: number; highAlpha?: number } = {},
): BottleMaskFeatures {
  if (mask.length !== width * height) {
    throw new Error("cutout_mask_size");
  }
  const subjectAlpha = options.subjectAlpha ?? PHOTO_CUTOUT_MASK.subjectAlpha;
  const lowAlpha = options.lowAlpha ?? PHOTO_CUTOUT_MASK.lowAlpha;
  const highAlpha = options.highAlpha ?? PHOTO_CUTOUT_MASK.highAlpha;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let decisive = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const edges = { left: 0, right: 0, top: 0, bottom: 0 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = mask[y * width + x] ?? 0;
      if (value <= lowAlpha || value >= highAlpha) {
        decisive += 1;
      }
      if (value < subjectAlpha) {
        continue;
      }
      count += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x === 0) edges.left += 1;
      if (x === width - 1) edges.right += 1;
      if (y === 0) edges.top += 1;
      if (y === height - 1) edges.bottom += 1;
    }
  }
  const pixels = width * height;
  const bbox: MaskBox | null =
    maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const components = count > 0 ? labelComponents(mask, width, height, subjectAlpha) : null;
  const largest = components && components.areas.length > 0 ? Math.max(...components.areas) : 0;
  return {
    width,
    height,
    foregroundRatio: count / pixels,
    bbox,
    bboxWidthRatio: bbox ? bbox.width / width : 0,
    bboxHeightRatio: bbox ? bbox.height / height : 0,
    bboxAspect: bbox ? bbox.height / bbox.width : 0,
    centerX: count > 0 ? sumX / count / Math.max(1, width - 1) : 0.5,
    centerY: count > 0 ? sumY / count / Math.max(1, height - 1) : 0.5,
    borderContact: {
      left: edges.left / height,
      right: edges.right / height,
      top: edges.top / width,
      bottom: edges.bottom / width,
    },
    dynamicRange: decisive / pixels,
    largestComponentRatio: count > 0 ? largest / count : 0,
  };
}

/**
 * ボトル切り抜きとして成立しているか。
 * 落とすのは「被写体がほぼ無い」「ほぼ全面が被写体（背景が残っている）」「左右両端まで被写体（背景を誤認）」だけ。
 * 縦横比・中心位置・連結成分は透明瓶や横置きで誤判定しやすいので記録にとどめる。
 */
export function validateBottleMask(
  features: BottleMaskFeatures,
  limits: MaskLimits = defaultLimits,
): MaskValidation {
  if (features.foregroundRatio < limits.minForegroundRatio) {
    return {
      ok: false,
      reason: "empty_mask",
      detail: `foreground=${ratio(features.foregroundRatio)}`,
      features,
    };
  }
  if (features.foregroundRatio >= limits.maxForegroundRatio) {
    return {
      ok: false,
      reason: "invalid_mask",
      detail: `foreground=${ratio(features.foregroundRatio)} (background kept)`,
      features,
    };
  }
  const { left, right } = features.borderContact;
  if (left >= limits.maxSideContact && right >= limits.maxSideContact) {
    return {
      ok: false,
      reason: "invalid_mask",
      detail: `side contact left=${ratio(left)} right=${ratio(right)}`,
      features,
    };
  }
  return { ok: true, features };
}

/** cleanup → 計測 → 判定をまとめたもの。呼び出し側は `mask` を使う */
export function refineBottleMask(
  mask: Uint8Array,
  width: number,
  height: number,
): { mask: Uint8Array; validation: MaskValidation } {
  const cleaned = cleanupMask(mask, width, height);
  const features = measureBottleMask(cleaned, width, height);
  return { mask: cleaned, validation: validateBottleMask(features) };
}

function ratio(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

/** 4 近傍の連結成分ラベリング。`labels` は 1 始まり（0 は背景）、`areas[label - 1]` が画素数 */
function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(mask.length);
  const areas: number[] = [];
  const stack = new Int32Array(mask.length);
  let nextLabel = 0;
  let top = 0;
  const visit = (index: number) => {
    if ((mask[index] ?? 0) >= threshold && labels[index] === 0) {
      labels[index] = nextLabel;
      stack[top] = index;
      top += 1;
    }
  };
  for (let start = 0; start < mask.length; start += 1) {
    if ((mask[start] ?? 0) < threshold || labels[start] !== 0) {
      continue;
    }
    nextLabel += 1;
    let area = 0;
    top = 0;
    visit(start);
    while (top > 0) {
      top -= 1;
      const index = stack[top] ?? 0;
      area += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    areas.push(area);
  }
  return { labels, areas };
}
