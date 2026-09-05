import { describe, expect, it } from "vitest";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { makeGif, makeHeic, makeJpeg, makePng, makeSvg, makeWebpVp8x } from "../image-fixtures.ts";
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";

describe("inspectImageBytes", () => {
  it("JPEG の magic と SOF0 寸法を読む", () => {
    const result = inspectImageBytes(makeJpeg(800, 1280));
    expect(result).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
      kind: "photo",
      width: 800,
      height: 1280,
    });
  });

  it("PNG の IHDR を読む", () => {
    const result = inspectImageBytes(makePng(640, 960));
    expect(result).toMatchObject({
      contentType: "image/png",
      width: 640,
      height: 960,
      kind: "photo",
    });
  });

  it("WebP VP8X の alpha フラグで kind を決める", () => {
    const photo = inspectImageBytes(makeWebpVp8x({ width: 400, height: 600, alpha: false }));
    expect(photo.kind).toBe("photo");
    expect(photo.contentType).toBe("image/webp");

    const cutout = inspectImageBytes(makeWebpVp8x({ width: 400, height: 600, alpha: true }));
    expect(cutout.kind).toBe("cutout");
  });

  it("GIF / SVG / HEIC は unsupported_media_type", () => {
    for (const bytes of [makeGif(), makeSvg(), makeHeic()]) {
      expect(() => inspectImageBytes(bytes)).toThrow(ImageInspectFailure);
      try {
        inspectImageBytes(bytes);
      } catch (error) {
        expect(error).toBeInstanceOf(ImageInspectFailure);
        if (error instanceof ImageInspectFailure) {
          expect(error.code).toBe("unsupported_media_type");
        }
      }
    }
  });

  it("1MB 超は payload_too_large", () => {
    const bytes = makeJpeg(10, 10, PHOTO_MAX_BYTES);
    expect(bytes.byteLength).toBeGreaterThan(PHOTO_MAX_BYTES);
    try {
      inspectImageBytes(bytes);
      throw new Error("unreachable");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageInspectFailure);
      if (error instanceof ImageInspectFailure) {
        expect(error.code).toBe("payload_too_large");
      }
    }
  });

  it("長辺 1600 超は invalid_dimensions", () => {
    try {
      inspectImageBytes(makeJpeg(1601, 100));
      throw new Error("unreachable");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageInspectFailure);
      if (error instanceof ImageInspectFailure) {
        expect(error.code).toBe("invalid_dimensions");
      }
    }
  });

  it("長辺 1600 ちょうどは通る", () => {
    expect(inspectImageBytes(makeJpeg(1600, 900)).width).toBe(1600);
  });
});
