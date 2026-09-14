import { PHOTO_CUTOUT_MASK } from "@/shared/constants.ts";

export type RotatedBuffer = {
  rgba: Uint8ClampedArray;
  mask: Uint8Array;
  width: number;
  height: number;
};

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 回転後の外接矩形。首・底が切れないようキャンバスを広げる */
function absTrig(value: number): number {
  const abs = Math.abs(value);
  return abs < 1e-10 ? 0 : abs;
}

export function rotatedBounds(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const rad = degreesToRadians(degrees);
  const cos = absTrig(Math.cos(rad));
  const sin = absTrig(Math.sin(rad));
  return {
    width: Math.max(1, Math.ceil(width * cos + height * sin)),
    height: Math.max(1, Math.ceil(width * sin + height * cos)),
  };
}

function sampleNearest(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return 0;
  }
  return mask[Math.floor(y) * width + Math.floor(x)] ?? 0;
}

function sampleBilinear(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  dest: Uint8ClampedArray,
  destOffset: number,
  alpha: number,
): void {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    dest[destOffset] = 0;
    dest[destOffset + 1] = 0;
    dest[destOffset + 2] = 0;
    dest[destOffset + 3] = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;
  for (let c = 0; c < 3; c += 1) {
    const top = (rgba[i00 + c] ?? 0) * (1 - tx) + (rgba[i10 + c] ?? 0) * tx;
    const bottom = (rgba[i01 + c] ?? 0) * (1 - tx) + (rgba[i11 + c] ?? 0) * tx;
    dest[destOffset + c] = Math.round(top * (1 - ty) + bottom * ty);
  }
  dest[destOffset + 3] = alpha;
}

/**
 * RGB とマスクへ同じ回転を一度だけ掛ける。回転済み画像を再回転しないこと。
 * 正の角度は時計回り（Canvas の y 下向き）。
 */
export function rotateRgbaAndMask(input: {
  rgba: Uint8ClampedArray;
  mask: Uint8Array;
  width: number;
  height: number;
  degrees: number;
}): RotatedBuffer {
  const degrees = ((input.degrees % 360) + 360) % 360;
  if (degrees === 0) {
    return {
      rgba: new Uint8ClampedArray(input.rgba),
      mask: new Uint8Array(input.mask),
      width: input.width,
      height: input.height,
    };
  }
  const bounds = rotatedBounds(input.width, input.height, degrees);
  const rad = degreesToRadians(degrees);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const srcCx = (input.width - 1) / 2;
  const srcCy = (input.height - 1) / 2;
  const destCx = (bounds.width - 1) / 2;
  const destCy = (bounds.height - 1) / 2;
  const rgba = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  const mask = new Uint8Array(bounds.width * bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const dx = x - destCx;
      const dy = y - destCy;
      const srcX = dx * cos + dy * sin + srcCx;
      const srcY = -dx * sin + dy * cos + srcCy;
      const alpha = sampleNearest(input.mask, input.width, input.height, srcX, srcY);
      const destIndex = y * bounds.width + x;
      mask[destIndex] = alpha;
      sampleBilinear(input.rgba, input.width, input.height, srcX, srcY, rgba, destIndex * 4, alpha);
    }
  }
  return { rgba, mask, width: bounds.width, height: bounds.height };
}

export function trimTransparent(
  input: RotatedBuffer,
  alphaThreshold = PHOTO_CUTOUT_MASK.bboxAlpha,
): RotatedBuffer {
  let minX = input.width;
  let minY = input.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      if ((input.mask[y * input.width + x] ?? 0) > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return input;
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width === input.width && height === input.height && minX === 0 && minY === 0) {
    return input;
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const srcRow = (minY + y) * input.width + minX;
    mask.set(input.mask.subarray(srcRow, srcRow + width), y * width);
    rgba.set(input.rgba.subarray(srcRow * 4, (srcRow + width) * 4), y * width * 4);
  }
  return { rgba, mask, width, height };
}

export function opaqueBoundingBox(
  mask: Uint8Array,
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
      if ((mask[y * width + x] ?? 0) > alphaThreshold) {
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
