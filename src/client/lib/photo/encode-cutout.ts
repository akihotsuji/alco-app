import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { CutoutError } from "./cutout-result.ts";
import { resizeKeepAspect } from "./geometry.ts";
import { isCutoutBlobType } from "./photo-file.ts";
import { toPngBlob, toWebpBlob } from "./to-jpeg-blob.ts";

export type CutoutEncodeFn = (canvas: HTMLCanvasElement) => Promise<Blob>;

export type EncodeCutoutOptions = {
  encodeWebp?: CutoutEncodeFn;
  encodePng?: CutoutEncodeFn;
  resize?: (canvas: HTMLCanvasElement, scale: number) => HTMLCanvasElement;
  maxBytes?: number;
};

function defaultResize(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  return resizeKeepAspect(canvas, canvas.width, canvas.height, {
    width: Math.max(1, Math.round(canvas.width * scale)),
    height: Math.max(1, Math.round(canvas.height * scale)),
  });
}

async function blobWithinLimit(
  canvas: HTMLCanvasElement,
  first: Blob,
  encode: CutoutEncodeFn,
  resize: (canvas: HTMLCanvasElement, scale: number) => HTMLCanvasElement,
  maxBytes: number,
): Promise<Blob> {
  if (first.size <= maxBytes) {
    return first;
  }
  for (const scale of [0.85, 0.7, 0.55, 0.4]) {
    const next = resize(canvas, scale);
    const blob = await encode(next);
    if (isCutoutBlobType(blob.type) && blob.size <= maxBytes) {
      return blob;
    }
  }
  throw new CutoutError("encode", `size>${maxBytes}`);
}

/**
 * 切り抜きキャンバスを保存用 Blob にする。
 * WebP を優先。iOS Safari は `toBlob("image/webp")` が PNG を返すことがあり、
 * その PNG（切り抜き済み・透過）を採用する。切り抜き前 JPEG には落とさない。
 */
export async function encodeCutoutBlob(
  canvas: HTMLCanvasElement,
  options: EncodeCutoutOptions = {},
): Promise<Blob> {
  const encodeWebp = options.encodeWebp ?? toWebpBlob;
  const encodePng = options.encodePng ?? toPngBlob;
  const resize = options.resize ?? defaultResize;
  const maxBytes = options.maxBytes ?? PHOTO_MAX_BYTES;

  const webp = await encodeWebp(canvas).catch(() => null);
  if (webp && isCutoutBlobType(webp.type)) {
    const encode = webp.type === "image/webp" ? encodeWebp : encodePng;
    return blobWithinLimit(canvas, webp, encode, resize, maxBytes);
  }

  const png = await encodePng(canvas);
  if (!isCutoutBlobType(png.type)) {
    throw new CutoutError("encode", `type=${png.type || "empty"}`);
  }
  return blobWithinLimit(canvas, png, encodePng, resize, maxBytes);
}
