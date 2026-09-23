import { PHOTO_THUMB_MAX_EDGE } from "@/shared/constants.ts";
import { fitToLongEdge, resizeKeepAspect } from "./geometry.ts";
import { toJpegBlob, toPngBlob } from "./to-jpeg-blob.ts";

/** 一覧用サムネ（`variant=thumb`）の JPEG 品質 */
export const PHOTO_THUMB_JPEG_QUALITY = 0.75;

/** 透過を持ちうる原本（切り抜き WebP / PNG）は PNG サムネ、それ以外は JPEG（サーバーの `kind` と揃える） */
export function uploadThumbType(originalType: string): "image/png" | "image/jpeg" {
  return originalType === "image/webp" || originalType === "image/png" ? "image/png" : "image/jpeg";
}

/**
 * 原本と一緒に送る長辺 400px のサムネを端末で作る。Worker では画像をデコードしない
 * （無料枠の CPU 10ms を超えるとアップロードが 503 になる）。作れなければ null で、原本だけ送る。
 */
export async function makeUploadThumb(original: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(original);
    const size = fitToLongEdge(bitmap.width, bitmap.height, PHOTO_THUMB_MAX_EDGE);
    const canvas = resizeKeepAspect(bitmap, bitmap.width, bitmap.height, size);
    return uploadThumbType(original.type) === "image/png"
      ? await toPngBlob(canvas)
      : await toJpegBlob(canvas, PHOTO_THUMB_JPEG_QUALITY);
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
