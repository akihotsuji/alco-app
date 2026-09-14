import { describe, expect, it } from "vitest";
import {
  PHOTO_CUTOUT_MODEL_SHA256,
  PHOTO_CUTOUT_PREPROCESS_VERSION,
  PHOTO_CUTOUT_WORK_MAX_EDGE,
  PHOTO_CUTOUT_WORK_MAX_PIXELS,
} from "@/shared/constants.ts";
import {
  computeInferenceRoi,
  inferenceKeyParts,
  mapModelToSource,
  mapSourceToModel,
  normalizeRoi,
  workImageSize,
} from "./cutout-roi.ts";

describe("computeInferenceRoi", () => {
  it("初期（scale=1）は 2:3 で切らず元写真全体", () => {
    expect(
      computeInferenceRoi({
        sourceWidth: 3000,
        sourceHeight: 4000,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ sx: 0, sy: 0, sw: 3000, sh: 4000 });
  });

  it("scale=1 のパンは推論 ROI を変えない（棚配置だけ）", () => {
    const panned = computeInferenceRoi({
      sourceWidth: 3000,
      sourceHeight: 4000,
      scale: 1,
      offsetX: 0.8,
      offsetY: -0.6,
    });
    expect(panned).toEqual({ sx: 0, sy: 0, sw: 3000, sh: 4000 });
  });

  it("縦長写真を拡大しても 2:3 で首・底を切らず元の縦横比の窓になる", () => {
    const roi = computeInferenceRoi({
      sourceWidth: 1080,
      sourceHeight: 1920,
      scale: 2,
      offsetX: 0,
      offsetY: 0,
    });
    expect(roi.sw / roi.sh).toBeCloseTo(1080 / 1920, 5);
    expect(roi.sw).toBeLessThan(1080);
    expect(roi.sh).toBeLessThan(1920);
    expect(roi.sx).toBeGreaterThanOrEqual(0);
    expect(roi.sy).toBeGreaterThanOrEqual(0);
    expect(roi.sx + roi.sw).toBeLessThanOrEqual(1080 + 1e-6);
    expect(roi.sy + roi.sh).toBeLessThanOrEqual(1920 + 1e-6);
  });

  it("横長写真の初期も全体を対象にする", () => {
    expect(
      computeInferenceRoi({
        sourceWidth: 4000,
        sourceHeight: 3000,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ).toEqual({ sx: 0, sy: 0, sw: 4000, sh: 3000 });
  });
});

describe("mapSourceToModel / mapModelToSource", () => {
  it("stretch の往復で ROI 内の点が戻る", () => {
    const roi = { sx: 100, sy: 40, sw: 800, sh: 1200 };
    const src = { x: 500, y: 640 };
    const model = mapSourceToModel(src.x, src.y, roi, 320);
    const back = mapModelToSource(model.x, model.y, roi, 320);
    expect(back.x).toBeCloseTo(src.x, 6);
    expect(back.y).toBeCloseTo(src.y, 6);
  });

  it("正方形モデル座標をそのまま元写真の角度に使わない（縦横で倍率が違う）", () => {
    const roi = { sx: 0, sy: 0, sw: 200, sh: 400 };
    const a = mapSourceToModel(100, 0, roi, 320);
    const b = mapSourceToModel(100, 400, roi, 320);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(Math.abs(b.y - a.y)).toBeCloseTo(320, 6);
    expect(mapModelToSource(160, 0, roi, 320).y).toBeCloseTo(0, 6);
    expect(mapModelToSource(160, 320, roi, 320).y).toBeCloseTo(400, 6);
  });
});

describe("workImageSize", () => {
  it("長辺と総画素の両方で制限する", () => {
    const tall = workImageSize(4000, 6000);
    expect(Math.max(tall.width, tall.height)).toBeLessThanOrEqual(PHOTO_CUTOUT_WORK_MAX_EDGE);
    expect(tall.width * tall.height).toBeLessThanOrEqual(PHOTO_CUTOUT_WORK_MAX_PIXELS);
    const small = workImageSize(800, 600);
    expect(small).toEqual({ width: 800, height: 600 });
  });
});

describe("inferenceKeyParts", () => {
  it("角度を含まず、ROI と前処理版とモデルを含む", () => {
    const key = inferenceKeyParts({
      sourceId: 3,
      roi: normalizeRoi({ sx: 0, sy: 0, sw: 100, sh: 200 }, 100, 200),
    });
    expect(key).toContain(PHOTO_CUTOUT_PREPROCESS_VERSION);
    expect(key).toContain(PHOTO_CUTOUT_MODEL_SHA256.slice(0, 12));
    expect(key).not.toContain("angle");
    expect(key).toContain("3|cellar");
  });

  it("比較モードでは provider をキーに含め、通常は含めない", () => {
    const roi = normalizeRoi({ sx: 0, sy: 0, sw: 100, sh: 200 }, 100, 200);
    const base = inferenceKeyParts({ sourceId: 1, roi });
    const compared = inferenceKeyParts({ sourceId: 1, roi, compareProvider: "webgpu" });
    expect(base).not.toContain("webgpu");
    expect(compared).toContain("webgpu");
    expect(compared).not.toBe(base);
  });
});
