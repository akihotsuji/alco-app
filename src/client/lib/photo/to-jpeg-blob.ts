import { PHOTO_JPEG_QUALITY, PHOTO_WEBP_QUALITY } from "@/shared/constants.ts";

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

export function toWebpBlob(canvas: HTMLCanvasElement, quality = PHOTO_WEBP_QUALITY): Promise<Blob> {
  return canvasToBlob(canvas, "image/webp", quality);
}
