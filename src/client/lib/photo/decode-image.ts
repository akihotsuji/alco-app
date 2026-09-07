import { decodeOutputSize } from "./geometry.ts";

export class PhotoDecodeError extends Error {
  constructor() {
    super("この写真を読み込めませんでした");
    this.name = "PhotoDecodeError";
  }
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    const first = await createImageBitmap(file, { imageOrientation: "from-image" });
    const target = decodeOutputSize(first.width, first.height);
    if (target.width === first.width && target.height === first.height) {
      return first;
    }
    const resized = await createImageBitmap(first, {
      resizeWidth: target.width,
      resizeHeight: target.height,
    });
    first.close();
    return resized;
  } catch {
    throw new PhotoDecodeError();
  }
}
