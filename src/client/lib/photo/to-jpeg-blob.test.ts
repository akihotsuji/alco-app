import { describe, expect, it } from "vitest";
import {
  assertUploadableBlob,
  JPEG_LIMIT_QUALITIES,
  JPEG_LIMIT_SCALES,
  PhotoSizeError,
  toJpegBlobWithinLimit,
} from "./to-jpeg-blob.ts";

function canvasStub(width = 80, height = 120): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

describe("toJpegBlobWithinLimit", () => {
  it("上限以内ならその Blob を返す", async () => {
    const ok = new Blob([new Uint8Array(8)], { type: "image/jpeg" });
    const blob = await toJpegBlobWithinLimit(canvasStub(), 16, {
      encodeJpeg: async () => ok,
    });
    expect(blob).toBe(ok);
    expect(blob.size).toBeLessThanOrEqual(16);
  });

  it("品質を下げても超えるときは解像度を下げ、最終サイズを再検査する", async () => {
    const sizes: number[] = [];
    let scale = 1;
    const blob = await toJpegBlobWithinLimit(canvasStub(), 10, {
      resize: (source, nextScale) => {
        scale = nextScale;
        return source;
      },
      encodeJpeg: async () => {
        const size = scale === 1 ? 50 : 8;
        sizes.push(size);
        return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
      },
    });
    expect(blob.size).toBe(8);
    expect(blob.size).toBeLessThanOrEqual(10);
    expect(sizes.some((size) => size > 10)).toBe(true);
  });

  it("最後の品質でも超えていれば送らず失敗する", async () => {
    await expect(
      toJpegBlobWithinLimit(canvasStub(), 4, {
        encodeJpeg: async () => new Blob([new Uint8Array(20)], { type: "image/jpeg" }),
      }),
    ).rejects.toBeInstanceOf(PhotoSizeError);
  });
});

describe("assertUploadableBlob", () => {
  it("上限超は送る前に落とす", () => {
    expect(() =>
      assertUploadableBlob(new Blob([new Uint8Array(11)], { type: "image/jpeg" }), 10),
    ).toThrow(PhotoSizeError);
    expect(() =>
      assertUploadableBlob(new Blob([new Uint8Array(10)], { type: "image/jpeg" }), 10),
    ).not.toThrow();
  });
});

describe("容量保証の段階", () => {
  it("品質と解像度の両方を試す", () => {
    expect(JPEG_LIMIT_QUALITIES.length).toBeGreaterThan(1);
    expect(JPEG_LIMIT_SCALES[0]).toBe(1);
    expect(JPEG_LIMIT_SCALES.at(-1)).toBeLessThan(1);
  });
});
