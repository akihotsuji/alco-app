import { describe, expect, it } from "vitest";
import { PHOTO_ASPECT, PHOTO_OUTPUT_LONG_EDGE } from "@/shared/constants.ts";
import {
  computeCoverCrop,
  computeCutoutPlacement,
  computeMascotLayout,
  outputSizeForAspect,
} from "./geometry.ts";

describe("outputSizeForAspect", () => {
  it("4:5 は高さが長辺 1280", () => {
    expect(outputSizeForAspect(PHOTO_ASPECT.log)).toEqual({
      width: Math.round(PHOTO_OUTPUT_LONG_EDGE * 0.8),
      height: PHOTO_OUTPUT_LONG_EDGE,
    });
  });

  it("2:3 は高さが長辺 1280", () => {
    expect(outputSizeForAspect(PHOTO_ASPECT.cellar)).toEqual({
      width: Math.round((PHOTO_OUTPUT_LONG_EDGE * 2) / 3),
      height: PHOTO_OUTPUT_LONG_EDGE,
    });
  });
});

describe("computeCoverCrop", () => {
  it("4:5・scale 1.0 で横長画像は左右を切る", () => {
    const crop = computeCoverCrop({
      sourceWidth: 4000,
      sourceHeight: 3000,
      aspect: PHOTO_ASPECT.log,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(crop.sh).toBe(3000);
    expect(crop.sw).toBe(2400);
    expect(crop.sx).toBe(800);
    expect(crop.sy).toBe(0);
  });

  it("2:3・scale 3.0 で窓が 1/3 になり中央に寄る", () => {
    const crop = computeCoverCrop({
      sourceWidth: 2000,
      sourceHeight: 3000,
      aspect: PHOTO_ASPECT.cellar,
      scale: 3,
      offsetX: 0,
      offsetY: 0,
    });
    expect(crop.sw).toBeCloseTo(2000 / 3);
    expect(crop.sh).toBeCloseTo(3000 / 3);
    expect(crop.sx).toBeCloseTo((2000 - 2000 / 3) / 2);
    expect(crop.sy).toBeCloseTo((3000 - 3000 / 3) / 2);
  });

  it("offset は窓が画像内に収まるようクランプする", () => {
    const crop = computeCoverCrop({
      sourceWidth: 2000,
      sourceHeight: 2000,
      aspect: PHOTO_ASPECT.log,
      scale: 2,
      offsetX: 4,
      offsetY: -4,
    });
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(2000 + 1e-6);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
  });
});

describe("computeMascotLayout", () => {
  it("右下・短辺 22%・余白 4%", () => {
    const layout = computeMascotLayout(1024, 1280);
    const short = 1024;
    expect(layout.height).toBeCloseTo(short * 0.22);
    expect(layout.width).toBeCloseTo(layout.height * 0.75);
    expect(layout.x).toBeCloseTo(1024 - layout.width - short * 0.04);
    expect(layout.y).toBeCloseTo(1280 - layout.height - short * 0.04);
    expect(layout.glowRadius).toBeCloseTo(layout.width * 0.6);
  });
});

describe("computeCutoutPlacement", () => {
  it("ボトルを下端揃え・落ち影は幅 80%", () => {
    const placed = computeCutoutPlacement({
      sourceWidth: 400,
      sourceHeight: 800,
      canvasWidth: 853,
      canvasHeight: 1280,
    });
    expect(placed.y + placed.height).toBeCloseTo(1280);
    expect(placed.x).toBeCloseTo((853 - placed.width) / 2);
    expect(placed.shadow.rx).toBeCloseTo((853 * 0.8) / 2);
    expect(placed.shadow.ry).toBe(3);
  });
});
