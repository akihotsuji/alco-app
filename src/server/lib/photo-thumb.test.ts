import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PHOTO_THUMB_MAX_BYTES } from "@/shared/constants.ts";
import { acceptClientThumb } from "../services/photos.ts";
import {
  photoDerivedR2Keys,
  photoR2KeysToDelete,
  photoThumbContentType,
  photoThumbR2Key,
} from "./photo-thumb.ts";

async function jpeg(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } },
    })
      .jpeg({ quality: 75 })
      .toBuffer(),
  );
}

async function png(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width, height, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } },
    })
      .png()
      .toBuffer(),
  );
}

describe("photo thumb keys", () => {
  it("原本キーから派生キーを決める", () => {
    expect(photoThumbR2Key("aaaa.jpg", "photo")).toBe("aaaa.thumb.jpg");
    expect(photoThumbR2Key("aaaa.webp", "cutout")).toBe("aaaa.thumb.png");
    expect(photoDerivedR2Keys("aaaa.jpg")).toEqual(["aaaa.thumb.jpg", "aaaa.thumb.png"]);
    expect(photoR2KeysToDelete("aaaa.jpg")).toEqual([
      "aaaa.jpg",
      "aaaa.thumb.jpg",
      "aaaa.thumb.png",
    ]);
    expect(photoThumbContentType("photo")).toBe("image/jpeg");
    expect(photoThumbContentType("cutout")).toBe("image/png");
  });
});

describe("acceptClientThumb（端末が作ったサムネ）", () => {
  it("種類に合う形式で長辺 400 以下なら受け取る", async () => {
    expect(acceptClientThumb(await jpeg(400, 300), "photo")).toBe(true);
    expect(acceptClientThumb(await png(267, 400), "cutout")).toBe(true);
  });

  it("形式違い・大きすぎる寸法・容量超過・画像でないものは捨てる", async () => {
    expect(acceptClientThumb(await png(267, 400), "photo")).toBe(false);
    expect(acceptClientThumb(await jpeg(400, 300), "cutout")).toBe(false);
    expect(acceptClientThumb(await jpeg(800, 600), "photo")).toBe(false);
    const huge = new Uint8Array(PHOTO_THUMB_MAX_BYTES + 1);
    huge.set(await jpeg(400, 300));
    expect(acceptClientThumb(huge, "photo")).toBe(false);
    expect(acceptClientThumb(new TextEncoder().encode("<svg/>"), "photo")).toBe(false);
    expect(acceptClientThumb(null, "photo")).toBe(false);
  });
});
