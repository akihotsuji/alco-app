import { describe, expect, it } from "vitest";
import { fitToLongEdge } from "./geometry.ts";
import { type PhotoEditParams, segmentationKeyFor } from "./process.ts";

function params(overrides: Partial<PhotoEditParams> = {}): PhotoEditParams {
  return {
    source: {} as unknown as CanvasImageSource,
    sourceWidth: 3000,
    sourceHeight: 4000,
    kind: "cellar",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    ...overrides,
  };
}

describe("segmentationKeyFor", () => {
  it("同じ画像・同じ編集条件なら同じキー（preview と使うで推論を共有する）", () => {
    const source = {} as unknown as CanvasImageSource;
    expect(segmentationKeyFor(params({ source }))).toBe(segmentationKeyFor(params({ source })));
  });

  it("拡縮・位置・画像オブジェクトが変わればキーも変わる", () => {
    const source = {} as unknown as CanvasImageSource;
    const base = segmentationKeyFor(params({ source }));
    expect(segmentationKeyFor(params({ source, scale: 1.5 }))).not.toBe(base);
    expect(segmentationKeyFor(params({ source, offsetX: 0.25 }))).not.toBe(base);
    expect(segmentationKeyFor(params({ source, offsetY: -0.5 }))).not.toBe(base);
    expect(segmentationKeyFor(params())).not.toBe(base);
  });
});

describe("fitToLongEdge", () => {
  it("長辺だけ縮め、写真全体の比を残す", () => {
    expect(fitToLongEdge(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitToLongEdge(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});
