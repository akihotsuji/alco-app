import { describe, expect, it } from "vitest";
import { type PhotoEditParams, presetForKind, segmentationKeyFor } from "./process.ts";

function params(overrides: Partial<PhotoEditParams> = {}): PhotoEditParams {
  return {
    source: {} as unknown as CanvasImageSource,
    sourceWidth: 3000,
    sourceHeight: 4000,
    kind: "cellar",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    filterOn: true,
    ...overrides,
  };
}

describe("segmentationKeyFor", () => {
  it("同じ画像・同じ編集条件なら同じキー（preview と使うで推論を共有する）", () => {
    const source = {} as unknown as CanvasImageSource;
    expect(segmentationKeyFor(params({ source }))).toBe(segmentationKeyFor(params({ source })));
  });

  it("色補正の ON/OFF はキーに含めない（マスクは未補正画像から作る）", () => {
    const source = {} as unknown as CanvasImageSource;
    expect(segmentationKeyFor(params({ source, filterOn: true }))).toBe(
      segmentationKeyFor(params({ source, filterOn: false })),
    );
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

describe("presetForKind", () => {
  it("OFF は none、セラーは cellar、他は table", () => {
    expect(presetForKind("cellar", false)).toBe("none");
    expect(presetForKind("cellar", true)).toBe("cellar");
    expect(presetForKind("log", true)).toBe("table");
    expect(presetForKind("note", true)).toBe("table");
  });
});
