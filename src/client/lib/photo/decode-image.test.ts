import { describe, expect, it, vi } from "vitest";
import {
  decodeImage,
  isHeicLike,
  PHOTO_UNSUPPORTED_MESSAGE,
  PhotoDecodeError,
} from "./decode-image.ts";

function fakeBitmap(width: number, height: number): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

describe("isHeicLike", () => {
  it("MIME と拡張子で HEIC / HEIF を見る", () => {
    expect(isHeicLike(new Blob([], { type: "image/heic" }))).toBe(true);
    expect(isHeicLike(new Blob([], { type: "image/heif" }))).toBe(true);
    expect(isHeicLike(new File([], "shot.HEIC", { type: "image/jpeg" }))).toBe(true);
    expect(isHeicLike(new Blob([], { type: "image/jpeg" }))).toBe(false);
  });
});

describe("decodeImage", () => {
  it("JPEG は from-image で向きを反映する", async () => {
    const createBitmap = vi.fn(async (_image: ImageBitmapSource, options?: ImageBitmapOptions) => {
      expect(options?.imageOrientation).toBe("from-image");
      return fakeBitmap(800, 600);
    });
    const bitmap = await decodeImage(new Blob([], { type: "image/jpeg" }), {
      createBitmap,
      loadImage: async () => {
        throw new Error("should not use img");
      },
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {},
    });
    expect(bitmap.width).toBe(800);
    expect(createBitmap).toHaveBeenCalledTimes(1);
  });

  it("createImageBitmap が失敗したら img 経路に落とす", async () => {
    const img = fakeBitmap(640, 480);
    const createBitmap = vi
      .fn()
      .mockRejectedValueOnce(new Error("from-image"))
      .mockRejectedValueOnce(new Error("plain"))
      .mockResolvedValueOnce(img);
    const revoke = vi.fn();
    const bitmap = await decodeImage(new Blob([], { type: "image/jpeg" }), {
      createBitmap,
      loadImage: async () => img,
      createObjectURL: () => "blob:fallback",
      revokeObjectURL: revoke,
    });
    expect(bitmap.width).toBe(640);
    expect(revoke).toHaveBeenCalledWith("blob:fallback");
  });

  it("HEIC は img 経路を先に使い、失敗時は形式エラーにする", async () => {
    const heicImage = fakeBitmap(100, 200);
    const createBitmap = vi.fn(async (image: ImageBitmapSource) => {
      expect(image).toBe(heicImage);
      return heicImage;
    });
    const heic = new File([], "label.heic", { type: "image/heic" });
    const bitmap = await decodeImage(heic, {
      createBitmap,
      loadImage: async () => heicImage,
      createObjectURL: () => "blob:heic",
      revokeObjectURL: () => {},
    });
    expect(bitmap.height).toBe(200);
    expect(createBitmap).toHaveBeenCalledTimes(1);

    await expect(
      decodeImage(heic, {
        createBitmap: async () => {
          throw new Error("no");
        },
        loadImage: async () => {
          throw new PhotoDecodeError();
        },
        createObjectURL: () => "blob:bad",
        revokeObjectURL: () => {},
      }),
    ).rejects.toThrow(PHOTO_UNSUPPORTED_MESSAGE);
  });
});
