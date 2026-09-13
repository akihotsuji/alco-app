import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";
import { PHOTO_THUMB_MAX_EDGE, type PhotoContentType, type PhotoKind } from "@/shared/constants.ts";
import { decodePngToRgba, encodeRgbaToPng, type RgbaImage } from "./png-rgba.ts";

export const PHOTO_THUMB_JPEG_QUALITY = 75;

export type GeneratedPhotoThumb = {
  bytes: Uint8Array;
  contentType: PhotoContentType;
};

function photoBaseFromR2Key(r2Key: string): string {
  const name = r2Key.includes("/") ? r2Key.slice(r2Key.lastIndexOf("/") + 1) : r2Key;
  const dot = name.indexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function photoThumbR2Key(r2Key: string, kind: PhotoKind): string {
  const base = photoBaseFromR2Key(r2Key);
  return kind === "cutout" ? `${base}.thumb.png` : `${base}.thumb.jpg`;
}

export function photoDerivedR2Keys(r2Key: string): string[] {
  const base = photoBaseFromR2Key(r2Key);
  return [`${base}.thumb.jpg`, `${base}.thumb.png`];
}

export function photoR2KeysToDelete(r2Key: string): string[] {
  return [r2Key, ...photoDerivedR2Keys(r2Key)];
}

export function photoThumbContentType(kind: PhotoKind): PhotoContentType {
  return kind === "cutout" ? "image/png" : "image/jpeg";
}

function toRgbaImage(width: number, height: number, data: Uint8Array): RgbaImage {
  return { width, height, data: data.slice() };
}

export function resizeRgba(image: RgbaImage, maxEdge: number): RgbaImage {
  const longEdge = Math.max(image.width, image.height);
  if (longEdge <= maxEdge) {
    return image;
  }
  const scale = maxEdge / longEdge;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = ((y + 0.5) * image.height) / height - 0.5;
    const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(sourceY)));
    const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
    const yMix = sourceY - Math.floor(sourceY);
    for (let x = 0; x < width; x += 1) {
      const sourceX = ((x + 0.5) * image.width) / width - 0.5;
      const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(sourceX)));
      const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
      const xMix = sourceX - Math.floor(sourceX);
      const dest = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const sample = (sx: number, sy: number) =>
          image.data[(sy * image.width + sx) * 4 + channel] ?? 0;
        const top = sample(x0, y0) * (1 - xMix) + sample(x1, y0) * xMix;
        const bottom = sample(x0, y1) * (1 - xMix) + sample(x1, y1) * xMix;
        data[dest + channel] = Math.round(top * (1 - yMix) + bottom * yMix);
      }
    }
  }
  return { width, height, data };
}

async function loadWebpDecWasm(): Promise<WebAssembly.Module> {
  try {
    const imported = await import("@jsquash/webp/codec/dec/webp_dec.wasm");
    const value = imported.default;
    if (value instanceof WebAssembly.Module) {
      return value;
    }
  } catch {
    // vitest / 未バンドル時はファイルから読む
  }
  const { createRequire } = await import("node:module");
  const { readFile } = await import("node:fs/promises");
  const require = createRequire(import.meta.url);
  return WebAssembly.compile(
    await readFile(require.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")),
  );
}

let webpReady: Promise<typeof import("@jsquash/webp/decode.js").default> | undefined;

async function decodeWebpToRgba(bytes: Uint8Array): Promise<RgbaImage> {
  if (!webpReady) {
    webpReady = (async () => {
      const { default: decode, init } = await import("@jsquash/webp/decode.js");
      await init(await loadWebpDecWasm());
      return decode;
    })();
  }
  const decode = await webpReady;
  const copy = bytes.slice();
  const decoded = await decode(copy.buffer);
  return toRgbaImage(decoded.width, decoded.height, decoded.data);
}

async function decodeToRgba(bytes: Uint8Array, contentType: PhotoContentType): Promise<RgbaImage> {
  if (contentType === "image/png") {
    return decodePngToRgba(bytes);
  }
  if (contentType === "image/webp") {
    return decodeWebpToRgba(bytes);
  }
  const decoded = decodeJpeg(bytes, { useTArray: true });
  return toRgbaImage(decoded.width, decoded.height, decoded.data);
}

async function encodeRgba(image: RgbaImage, kind: PhotoKind): Promise<GeneratedPhotoThumb> {
  if (kind === "cutout") {
    return { bytes: await encodeRgbaToPng(image), contentType: "image/png" };
  }
  const encoded = encodeJpeg(
    { width: image.width, height: image.height, data: image.data },
    PHOTO_THUMB_JPEG_QUALITY,
  );
  return { bytes: encoded.data, contentType: "image/jpeg" };
}

export async function generatePhotoThumb(
  bytes: Uint8Array,
  contentType: PhotoContentType,
  kind: PhotoKind,
): Promise<GeneratedPhotoThumb | null> {
  try {
    const decoded = await decodeToRgba(bytes, contentType);
    const resized = resizeRgba(decoded, PHOTO_THUMB_MAX_EDGE);
    return await encodeRgba(resized, kind);
  } catch {
    return null;
  }
}
