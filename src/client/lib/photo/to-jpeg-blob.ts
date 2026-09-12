import { PHOTO_JPEG_QUALITY, PHOTO_MAX_BYTES, PHOTO_WEBP_QUALITY } from "@/shared/constants.ts";

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

/** サーバーの 1MB 上限に収まるまで品質を下げる。位置情報は Canvas 経由で残らない */
export async function toJpegBlobWithinLimit(
  canvas: HTMLCanvasElement,
  maxBytes = PHOTO_MAX_BYTES,
): Promise<Blob> {
  for (const quality of [PHOTO_JPEG_QUALITY, 0.72, 0.6, 0.48]) {
    const blob = await toJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      return blob;
    }
  }
  return toJpegBlob(canvas, 0.4);
}

export function toWebpBlob(canvas: HTMLCanvasElement, quality = PHOTO_WEBP_QUALITY): Promise<Blob> {
  return canvasToBlob(canvas, "image/webp", quality);
}

/** 切り抜きキャンバス用。品質引数は PNG では無視される */
export function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return canvasToBlob(canvas, "image/png", 1);
}
