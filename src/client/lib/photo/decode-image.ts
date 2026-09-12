import { decodeOutputSize } from "./geometry.ts";

export const PHOTO_UNSUPPORTED_MESSAGE = "この形式は使えません。JPEG / PNG を選んでください";

export class PhotoDecodeError extends Error {
  constructor(message = "この写真を読み込めませんでした") {
    super(message);
    this.name = "PhotoDecodeError";
  }
}

export type DecodedHtmlImage = CanvasImageSource & { width: number; height: number };

export type DecodeImageDeps = {
  createBitmap: (image: ImageBitmapSource, options?: ImageBitmapOptions) => Promise<ImageBitmap>;
  loadImage: (url: string) => Promise<DecodedHtmlImage>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export function isHeicLike(file: Blob): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    return true;
  }
  if (file instanceof File) {
    const name = file.name.toLowerCase();
    return name.endsWith(".heic") || name.endsWith(".heif");
  }
  return false;
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PhotoDecodeError());
    image.src = url;
  });
}

const defaultDeps: DecodeImageDeps = {
  createBitmap: (image, options) => createImageBitmap(image, options),
  loadImage: loadHtmlImage,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

async function resizeDecoded(bitmap: ImageBitmap, deps: DecodeImageDeps): Promise<ImageBitmap> {
  const target = decodeOutputSize(bitmap.width, bitmap.height);
  if (target.width === bitmap.width && target.height === bitmap.height) {
    return bitmap;
  }
  try {
    const resized = await deps.createBitmap(bitmap, {
      resizeWidth: target.width,
      resizeHeight: target.height,
    });
    bitmap.close();
    return resized;
  } catch {
    bitmap.close();
    throw new PhotoDecodeError();
  }
}

async function decodeViaCreateImageBitmap(file: Blob, deps: DecodeImageDeps): Promise<ImageBitmap> {
  try {
    return await resizeDecoded(
      await deps.createBitmap(file, { imageOrientation: "from-image" }),
      deps,
    );
  } catch {
    return resizeDecoded(await deps.createBitmap(file), deps);
  }
}

async function decodeViaHtmlImage(file: Blob, deps: DecodeImageDeps): Promise<ImageBitmap> {
  const url = deps.createObjectURL(file);
  try {
    const image = await deps.loadImage(url);
    if (image.width < 1 || image.height < 1) {
      throw new PhotoDecodeError();
    }
    return await resizeDecoded(await deps.createBitmap(image), deps);
  } finally {
    deps.revokeObjectURL(url);
  }
}

/**
 * EXIF 向きを反映して ImageBitmap にする。
 * HEIC と createImageBitmap 失敗は Safari の `<img>` 経路（07-photo-capture）。
 */
export async function decodeImage(
  file: Blob,
  deps: DecodeImageDeps = defaultDeps,
): Promise<ImageBitmap> {
  try {
    if (isHeicLike(file)) {
      return await decodeViaHtmlImage(file, deps);
    }
    try {
      return await decodeViaCreateImageBitmap(file, deps);
    } catch {
      return await decodeViaHtmlImage(file, deps);
    }
  } catch (error) {
    if (error instanceof PhotoDecodeError) {
      throw isHeicLike(file) ? new PhotoDecodeError(PHOTO_UNSUPPORTED_MESSAGE) : error;
    }
    throw new PhotoDecodeError(isHeicLike(file) ? PHOTO_UNSUPPORTED_MESSAGE : undefined);
  }
}
