import { PHOTO_DECODE_MAX_EDGE } from "@/shared/constants.ts";

export class PhotoDecodeError extends Error {
  constructor() {
    super("この写真を読み込めませんでした");
    this.name = "PhotoDecodeError";
  }
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    const first = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longEdge = Math.max(first.width, first.height);
    if (longEdge <= PHOTO_DECODE_MAX_EDGE) {
      return first;
    }
    const scale = PHOTO_DECODE_MAX_EDGE / longEdge;
    const resized = await createImageBitmap(first, {
      resizeWidth: Math.round(first.width * scale),
      resizeHeight: Math.round(first.height * scale),
    });
    first.close();
    return resized;
  } catch {
    throw new PhotoDecodeError();
  }
}
