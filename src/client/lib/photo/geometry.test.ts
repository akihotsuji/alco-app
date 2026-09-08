import { describe, expect, it } from "vitest";
import { PHOTO_ASPECT, PHOTO_DECODE_MAX_EDGE, PHOTO_OUTPUT_LONG_EDGE } from "@/shared/constants.ts";
import {
  alphaBoundingBox,
  aspectForKind,
  computeCoverCrop,
  computeCutoutPlacement,
  computeMascotLayout,
  decodeOutputSize,
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

  it("幅も高さも長辺上限以下", () => {
    const portrait = outputSizeForAspect(PHOTO_ASPECT.cellar);
    expect(portrait.width).toBeLessThanOrEqual(PHOTO_OUTPUT_LONG_EDGE);
    expect(portrait.height).toBeLessThanOrEqual(PHOTO_OUTPUT_LONG_EDGE);
    const landscape = outputSizeForAspect({ width: 16, height: 9 });
    expect(landscape.width).toBe(PHOTO_OUTPUT_LONG_EDGE);
    expect(landscape.height).toBeLessThanOrEqual(PHOTO_OUTPUT_LONG_EDGE);
    const square = outputSizeForAspect({ width: 1, height: 1 }, 800);
    expect(square.width).toBe(800);
    expect(square.height).toBe(800);
  });
});

describe("decodeOutputSize", () => {
  it("長辺が上限以下ならそのまま", () => {
    expect(decodeOutputSize(1280, 1920)).toEqual({ width: 1280, height: 1920 });
  });

  it("超えた辺を上限に合わせ、幅は上限以下", () => {
    const sized = decodeOutputSize(4000, 3000);
    expect(sized.width).toBe(PHOTO_DECODE_MAX_EDGE);
    expect(sized.height).toBe(Math.round((3000 * PHOTO_DECODE_MAX_EDGE) / 4000));
    expect(sized.width).toBeLessThanOrEqual(PHOTO_DECODE_MAX_EDGE);
    expect(sized.height).toBeLessThanOrEqual(PHOTO_DECODE_MAX_EDGE);
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
    expect("glowRadius" in layout).toBe(false);
  });
});

describe("computeCutoutPlacement", () => {
  it("ボトルを下端から 4% 空け、落ち影はボトル幅の 80%", () => {
    const placed = computeCutoutPlacement({
      sourceWidth: 400,
      sourceHeight: 800,
      canvasWidth: 853,
      canvasHeight: 1280,
    });
    expect(placed.y + placed.height).toBeCloseTo(1280 * 0.96);
    expect(placed.x).toBeCloseTo((853 - placed.width) / 2);
    expect(placed.shadow.rx).toBeCloseTo((placed.width * 0.8) / 2);
    expect(placed.shadow.x).toBeCloseTo(placed.x + placed.width / 2);
    expect(placed.shadow.y).toBeCloseTo(placed.y + placed.height);
    expect(placed.shadow.ry).toBe(3);
  });
});

describe("alphaBoundingBox", () => {
  it("不透明画素の外接矩形を返す", () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    paintPixel(data, width, 1, 1, 200);
    paintPixel(data, width, 2, 2, 200);
    expect(alphaBoundingBox(data, width, height)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  });

  it("全面透明なら null", () => {
    const data = new Uint8ClampedArray(16);
    expect(alphaBoundingBox(data, 2, 2)).toBeNull();
  });
});

function paintPixel(data: Uint8ClampedArray, width: number, x: number, y: number, alpha: number) {
  const offset = (y * width + x) * 4;
  data[offset] = 10;
  data[offset + 1] = 10;
  data[offset + 2] = 10;
  data[offset + 3] = alpha;
}

describe("aspectForKind", () => {
  it("セラーだけ 2:3、記録とノートは 4:5", () => {
    expect(aspectForKind("cellar")).toEqual(PHOTO_ASPECT.cellar);
    expect(aspectForKind("log")).toEqual(PHOTO_ASPECT.log);
    expect(aspectForKind("note")).toEqual(PHOTO_ASPECT.log);
  });
});
