import { PHOTO_JPEG_QUALITY, PHOTO_MAX_BYTES, PHOTO_WEBP_QUALITY } from "@/shared/constants.ts";
import { resizeKeepAspect } from "./geometry.ts";

export class PhotoSizeError extends Error {
  readonly code = "size_exceeded" as const;

  constructor() {
    super("size_exceeded");
    this.name = "PhotoSizeError";
  }
}

export const JPEG_LIMIT_QUALITIES = [PHOTO_JPEG_QUALITY, 0.72, 0.6, 0.48, 0.4] as const;
export const JPEG_LIMIT_SCALES = [1, 0.85, 0.7, 0.55, 0.4] as const;

export type JpegWithinLimitOptions = {
  encodeJpeg?: (canvas: HTMLCanvasElement, quality: number) => Promise<Blob>;
  resize?: (canvas: HTMLCanvasElement, scale: number) => HTMLCanvasElement;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像化に失敗しました"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export function toJpegBlob(canvas: HTMLCanvasElement, quality = PHOTO_JPEG_QUALITY): Promise<Blob> {
  return canvasToBlob(canvas, "image/jpeg", quality);
}

function defaultResize(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale === 1) {
    return canvas;
  }
  return resizeKeepAspect(canvas, canvas.width, canvas.height, {
    width: Math.max(1, Math.round(canvas.width * scale)),
    height: Math.max(1, Math.round(canvas.height * scale)),
  });
}

/**
 * サーバーの 1MB 上限に収まるまで品質を下げ、必要なら解像度も下げる。
 * 最後の書き出しでも超えていれば送らず失敗にする。位置情報は Canvas 経由で残らない。
 */
export async function toJpegBlobWithinLimit(
  canvas: HTMLCanvasElement,
  maxBytes = PHOTO_MAX_BYTES,
  options: JpegWithinLimitOptions = {},
): Promise<Blob> {
  const encode = options.encodeJpeg ?? toJpegBlob;
  const resize = options.resize ?? defaultResize;
  for (const scale of JPEG_LIMIT_SCALES) {
    const source = resize(canvas, scale);
    for (const quality of JPEG_LIMIT_QUALITIES) {
      const blob = await encode(source, quality);
      if (blob.size <= maxBytes) {
        return blob;
      }
    }
  }
  throw new PhotoSizeError();
}

export function assertUploadableBlob(blob: Blob, maxBytes = PHOTO_MAX_BYTES): void {
  if (blob.size > maxBytes) {
    throw new PhotoSizeError();
  }
}

export function toWebpBlob(canvas: HTMLCanvasElement, quality = PHOTO_WEBP_QUALITY): Promise<Blob> {
  return canvasToBlob(canvas, "image/webp", quality);
}

/** 切り抜きキャンバス用。品質引数は PNG では無視される */
export function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return canvasToBlob(canvas, "image/png", 1);
}
