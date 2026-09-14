import { PHOTO_CUTOUT_MASK } from "@/shared/constants.ts";

export type CutoutWorkMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type CutoutMaskIdentity = {
  sourceId: number;
  segmentationKey: string;
  width: number;
  height: number;
};

export type CommittedCutoutMask = CutoutMaskIdentity & {
  revision: number;
  data: Uint8Array;
};

export type MaskSaveBlockReason = "mismatch" | "empty" | "encode" | "invalid";

export function copyMaskBytes(mask: Uint8Array): Uint8Array {
  return new Uint8Array(mask);
}

export function copyWorkMask(mask: CutoutWorkMask): CutoutWorkMask {
  return { width: mask.width, height: mask.height, data: copyMaskBytes(mask.data) };
}

export function maskByteLength(mask: CutoutWorkMask): number {
  return mask.data.byteLength;
}

export function workMaskEquals(left: CutoutWorkMask, right: CutoutWorkMask): boolean {
  if (left.width !== right.width || left.height !== right.height) {
    return false;
  }
  if (left.data.length !== right.data.length) {
    return false;
  }
  for (let i = 0; i < left.data.length; i += 1) {
    if (left.data[i] !== right.data[i]) {
      return false;
    }
  }
  return true;
}

export function extractAlphaChannel(rgba: Uint8ClampedArray): Uint8Array {
  const pixels = Math.floor(rgba.length / 4);
  const out = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    out[i] = rgba[i * 4 + 3] ?? 0;
  }
  return out;
}

/** 入力本来のアルファを超えて不透明化しない */
export function composeSelectionWithSourceAlpha(
  selection: Uint8Array,
  sourceAlpha: Uint8Array,
): Uint8Array {
  const count = Math.min(selection.length, sourceAlpha.length);
  const out = new Uint8Array(selection.length);
  for (let i = 0; i < count; i += 1) {
    const selected = selection[i] ?? 0;
    const inherent = sourceAlpha[i] ?? 0;
    out[i] = selected < inherent ? selected : inherent;
  }
  return out;
}

export function applyComposedAlpha(
  rgba: Uint8ClampedArray,
  selection: Uint8Array,
  sourceAlpha: Uint8Array,
): void {
  const pixels = Math.min(selection.length, sourceAlpha.length, Math.floor(rgba.length / 4));
  for (let i = 0; i < pixels; i += 1) {
    const selected = selection[i] ?? 0;
    const inherent = sourceAlpha[i] ?? 0;
    rgba[i * 4 + 3] = selected < inherent ? selected : inherent;
  }
}

export function isSelectionMaskEmpty(
  mask: Uint8Array,
  threshold = PHOTO_CUTOUT_MASK.bboxAlpha,
): boolean {
  for (let i = 0; i < mask.length; i += 1) {
    if ((mask[i] ?? 0) > threshold) {
      return false;
    }
  }
  return true;
}

export function cutoutMaskIdentityEquals(
  left: CutoutMaskIdentity,
  right: CutoutMaskIdentity,
): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.segmentationKey === right.segmentationKey &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function inspectCommittedMask(
  mask: CommittedCutoutMask,
  current: CutoutMaskIdentity,
): MaskSaveBlockReason | "ok" {
  if (mask.width <= 0 || mask.height <= 0 || mask.data.length !== mask.width * mask.height) {
    return "invalid";
  }
  if (!cutoutMaskIdentityEquals(mask, current)) {
    return "mismatch";
  }
  if (isSelectionMaskEmpty(mask.data)) {
    return "empty";
  }
  return "ok";
}

export function snapshotCommittedMask(
  identity: CutoutMaskIdentity,
  mask: CutoutWorkMask,
  revision: number,
): CommittedCutoutMask {
  return {
    ...identity,
    revision,
    width: mask.width,
    height: mask.height,
    data: copyMaskBytes(mask.data),
  };
}

export type MaskRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function expandRect(
  current: MaskRect | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
): MaskRect {
  const left = Math.max(0, Math.min(x0, x1));
  const top = Math.max(0, Math.min(y0, y1));
  const right = Math.min(width - 1, Math.max(x0, x1));
  const bottom = Math.min(height - 1, Math.max(y0, y1));
  if (right < left || bottom < top) {
    return current ?? { x: 0, y: 0, width: 0, height: 0 };
  }
  if (!current || current.width <= 0 || current.height <= 0) {
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
  const nextLeft = Math.min(current.x, left);
  const nextTop = Math.min(current.y, top);
  const nextRight = Math.max(current.x + current.width - 1, right);
  const nextBottom = Math.max(current.y + current.height - 1, bottom);
  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft + 1,
    height: nextBottom - nextTop + 1,
  };
}

export function copyMaskRect(mask: Uint8Array, width: number, rect: MaskRect): Uint8Array {
  const out = new Uint8Array(Math.max(0, rect.width * rect.height));
  if (rect.width <= 0 || rect.height <= 0) {
    return out;
  }
  for (let y = 0; y < rect.height; y += 1) {
    const src = (rect.y + y) * width + rect.x;
    out.set(mask.subarray(src, src + rect.width), y * rect.width);
  }
  return out;
}

export function writeMaskRect(
  dest: Uint8Array,
  width: number,
  rect: MaskRect,
  pixels: Uint8Array,
): void {
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  for (let y = 0; y < rect.height; y += 1) {
    const destRow = (rect.y + y) * width + rect.x;
    dest.set(pixels.subarray(y * rect.width, y * rect.width + rect.width), destRow);
  }
}

export function opaqueSelectionBox(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold = PHOTO_CUTOUT_MASK.bboxAlpha,
): MaskRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) > threshold) {
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
