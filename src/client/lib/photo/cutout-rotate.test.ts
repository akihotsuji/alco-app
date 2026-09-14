import { describe, expect, it } from "vitest";
import { PHOTO_ASPECT, PHOTO_CUTOUT_MASK } from "@/shared/constants.ts";
import {
  opaqueBoundingBox,
  rotatedBounds,
  rotateRgbaAndMask,
  trimTransparent,
} from "./cutout-rotate.ts";
import { computeCutoutPlacement, outputSizeForAspect } from "./geometry.ts";

function paintBottle(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): { rgba: Uint8ClampedArray; mask: Uint8Array } {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8Array(width * height);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const i = y * width + x;
      mask[i] = 255;
      rgba[i * 4] = 40;
      rgba[i * 4 + 1] = 20;
      rgba[i * 4 + 2] = 10;
      rgba[i * 4 + 3] = 255;
    }
  }
  return { rgba, mask };
}

function opaqueCount(mask: Uint8Array): number {
  return mask.reduce((sum, value) => sum + (value > PHOTO_CUTOUT_MASK.bboxAlpha ? 1 : 0), 0);
}

describe("rotatedBounds", () => {
  it("90 度で幅と高さが入れ替わる", () => {
    expect(rotatedBounds(40, 80, 90)).toEqual({ width: 80, height: 40 });
  });

  it("任意角度で対角が収まる", () => {
    const bounds = rotatedBounds(40, 80, 33);
    expect(bounds.width).toBeGreaterThanOrEqual(40);
    expect(bounds.height).toBeGreaterThanOrEqual(80);
  });
});

describe("rotateRgbaAndMask", () => {
  const width = 40;
  const height = 80;
  const bottle = { x: 14, y: 6, w: 12, h: 68 };

  it("90 度でも首と底の画素が残る", () => {
    const source = paintBottle(width, height, bottle);
    const rotated = rotateRgbaAndMask({ ...source, width, height, degrees: 90 });
    const box = opaqueBoundingBox(
      rotated.mask,
      rotated.width,
      rotated.height,
      PHOTO_CUTOUT_MASK.bboxAlpha,
    );
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    expect(box.width).toBeGreaterThan(60);
    expect(box.height).toBeGreaterThan(8);
    expect(opaqueCount(rotated.mask)).toBeGreaterThan(opaqueCount(source.mask) * 0.85);
  });

  it("180 度でも首底が欠けない", () => {
    const source = paintBottle(width, height, bottle);
    const rotated = rotateRgbaAndMask({ ...source, width, height, degrees: 180 });
    const box = opaqueBoundingBox(
      rotated.mask,
      rotated.width,
      rotated.height,
      PHOTO_CUTOUT_MASK.bboxAlpha,
    );
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    expect(box.height).toBeGreaterThan(60);
    expect(opaqueCount(rotated.mask)).toBeGreaterThan(opaqueCount(source.mask) * 0.85);
  });

  it("任意角度のあとに余白を除いても画素が残る", () => {
    const source = paintBottle(width, height, bottle);
    const rotated = trimTransparent(rotateRgbaAndMask({ ...source, width, height, degrees: 17 }));
    const box = opaqueBoundingBox(
      rotated.mask,
      rotated.width,
      rotated.height,
      PHOTO_CUTOUT_MASK.bboxAlpha,
    );
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    expect(box.x).toBeLessThanOrEqual(2);
    expect(box.y).toBeLessThanOrEqual(2);
    expect(box.x + box.width).toBeGreaterThanOrEqual(rotated.width - 2);
    expect(box.y + box.height).toBeGreaterThanOrEqual(rotated.height - 2);
  });

  it("RGB とマスクに同じ変換を掛け、0 度は複製だけ", () => {
    const source = paintBottle(width, height, bottle);
    const same = rotateRgbaAndMask({ ...source, width, height, degrees: 0 });
    expect(same.width).toBe(width);
    expect(same.height).toBe(height);
    expect(same.mask).not.toBe(source.mask);
    expect(same.mask[6 * width + 14]).toBe(255);
    expect(same.rgba[(6 * width + 14) * 4 + 3]).toBe(255);
  });
});

describe("棚用 2:3 配置", () => {
  it("下端揃えと 4% 余白が回転後サイズでも成り立つ", () => {
    const output = outputSizeForAspect(PHOTO_ASPECT.cellar);
    const placed = computeCutoutPlacement({
      sourceWidth: 120,
      sourceHeight: 300,
      canvasWidth: output.width,
      canvasHeight: output.height,
    });
    expect(placed.y + placed.height).toBeCloseTo(output.height * 0.96);
    expect(placed.x).toBeCloseTo((output.width - placed.width) / 2);
    expect(placed.shadow.y).toBeCloseTo(placed.y + placed.height);
  });
});
