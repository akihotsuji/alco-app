import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHOTO_OUTPUT_LONG_EDGE, PHOTO_RECOGNIZE_LONG_EDGE } from "@/shared/constants.ts";
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
  it("同じ画像・同じ推論 ROI なら同じキー（preview と使うで推論を共有する）", () => {
    const source = {} as unknown as CanvasImageSource;
    expect(segmentationKeyFor(params({ source }))).toBe(segmentationKeyFor(params({ source })));
  });

  it("scale=1 のパンはキーを変えない（角度・棚配置は推論キーに入れない）", () => {
    const source = {} as unknown as CanvasImageSource;
    const base = segmentationKeyFor(params({ source }));
    expect(segmentationKeyFor(params({ source, offsetX: 0.25 }))).toBe(base);
    expect(segmentationKeyFor(params({ source, offsetY: -0.5 }))).toBe(base);
  });

  it("拡大で ROI が変わればキーも変わる。別画像も変わる", () => {
    const source = {} as unknown as CanvasImageSource;
    const base = segmentationKeyFor(params({ source }));
    expect(segmentationKeyFor(params({ source, scale: 1.5 }))).not.toBe(base);
    expect(segmentationKeyFor(params({ source, scale: 1.5, offsetX: 0.4 }))).not.toBe(
      segmentationKeyFor(params({ source, scale: 1.5 })),
    );
    expect(segmentationKeyFor(params())).not.toBe(base);
  });
});

describe("fitToLongEdge", () => {
  it("長辺だけ縮め、写真全体の比を残す", () => {
    expect(fitToLongEdge(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitToLongEdge(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
});

describe("toRecognizeJpeg", () => {
  it("認識用は表示用 1280 より小さい 1024 に収める（既に小さければ据え置き）", () => {
    expect(PHOTO_RECOGNIZE_LONG_EDGE).toBeLessThan(PHOTO_OUTPUT_LONG_EDGE);
    expect(fitToLongEdge(1280, 960, PHOTO_RECOGNIZE_LONG_EDGE)).toEqual({
      width: 1024,
      height: 768,
    });
    expect(fitToLongEdge(900, 1000, PHOTO_RECOGNIZE_LONG_EDGE)).toEqual({
      width: 900,
      height: 1000,
    });
  });

  it("記録・ノート・セラーの認識用 JPEG はすべて toRecognizeJpeg を通す", () => {
    const source = readFileSync(new URL("./process.ts", import.meta.url), "utf8");
    const matches = source.match(/const recognizeJpeg = await toRecognizeJpeg\(/g) ?? [];
    expect(matches).toHaveLength(3);
    expect(source).not.toMatch(/const recognizeJpeg = await toJpegBlob/);
  });

  it("保存済み表面は toRecognizeJpegFromBlob で JPEG 化する（recognize は JPEG 以外 415）", () => {
    const source = readFileSync(new URL("./process.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function toRecognizeJpegFromBlob");
    expect(source).toContain("decodeImage(blob)");
    expect(source).toContain("toJpegBlobWithinLimit(canvas)");
  });
});

describe("processCellarPhoto 切り抜きエンコード", () => {
  it("使うは encodeCutoutBlob で、WebP 以外を切り抜き前 JPEG に落とさない", () => {
    const source = readFileSync(new URL("./process.ts", import.meta.url), "utf8");
    expect(source).toContain("encodeCutoutBlob(dest)");
    expect(source).not.toContain('if (blob.type !== "image/webp")');
    expect(source).not.toContain("toWebpBlob(dest)");
    expect(source).toContain("toJpegBlobWithinLimit(prepared.cropped)");
    expect(source).toContain('cutoutQueue ?? "fifo"');
    expect(source).toContain('queue: "latest"');
    expect(source).toContain("rotationDegrees");
    expect(source).toContain("prepareCutoutWork");
    expect(source).toContain("composeCutoutPreview");
  });
});
