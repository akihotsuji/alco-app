import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PHOTO_THUMB_MAX_EDGE } from "@/shared/constants.ts";
import { makeJpeg } from "../image-fixtures.ts";
import { inspectImageBytes } from "../services/image-inspect.ts";
import {
  generatePhotoThumb,
  photoDerivedR2Keys,
  photoR2KeysToDelete,
  photoThumbR2Key,
  resizeRgba,
} from "./photo-thumb.ts";
import { decodePngToRgba } from "./png-rgba.ts";

async function realJpeg(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width, height, channels: 3, background: { r: 180, g: 40, b: 40 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer(),
  );
}

async function realPng(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer(),
  );
}

async function realWebp(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 0.5 },
      },
    })
      .webp({ quality: 80 })
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
  });
});

describe("resizeRgba", () => {
  it("長辺が上限以下ならそのまま、超えたら比率を保つ", () => {
    const small = {
      width: 40,
      height: 60,
      data: new Uint8Array(40 * 60 * 4),
    };
    expect(resizeRgba(small, PHOTO_THUMB_MAX_EDGE)).toBe(small);
    const large = {
      width: 800,
      height: 600,
      data: new Uint8Array(800 * 600 * 4),
    };
    const resized = resizeRgba(large, PHOTO_THUMB_MAX_EDGE);
    expect(resized.width).toBe(400);
    expect(resized.height).toBe(300);
  });
});

describe("generatePhotoThumb", () => {
  it("最低限 JPEG はデコードできず null", async () => {
    await expect(generatePhotoThumb(makeJpeg(80, 80), "image/jpeg", "photo")).resolves.toBeNull();
  });

  it("JPEG を長辺 400 の JPEG にする", async () => {
    const thumb = await generatePhotoThumb(await realJpeg(800, 600), "image/jpeg", "photo");
    expect(thumb).not.toBeNull();
    if (!thumb) {
      return;
    }
    expect(thumb.contentType).toBe("image/jpeg");
    const inspected = inspectImageBytes(thumb.bytes);
    expect(inspected.width).toBe(400);
    expect(inspected.height).toBe(300);
    expect(inspected.kind).toBe("photo");
  });

  it("PNG 切り抜きはアルファ付き PNG のまま縮小する", async () => {
    const thumb = await generatePhotoThumb(await realPng(400, 600), "image/png", "cutout");
    expect(thumb).not.toBeNull();
    if (!thumb) {
      return;
    }
    expect(thumb.contentType).toBe("image/png");
    const inspected = inspectImageBytes(thumb.bytes);
    expect(inspected.width).toBe(267);
    expect(inspected.height).toBe(400);
    expect(inspected.kind).toBe("cutout");
    const decoded = await decodePngToRgba(thumb.bytes);
    expect(decoded.data[3]).toBeLessThan(255);
  });

  it("WebP 切り抜きは PNG サムネにする", async () => {
    const thumb = await generatePhotoThumb(await realWebp(400, 600), "image/webp", "cutout");
    expect(thumb).not.toBeNull();
    if (!thumb) {
      return;
    }
    expect(thumb.contentType).toBe("image/png");
    const inspected = inspectImageBytes(thumb.bytes);
    expect(Math.max(inspected.width, inspected.height)).toBe(PHOTO_THUMB_MAX_EDGE);
    expect(inspected.kind).toBe("cutout");
  });
});
