import { decodeImage } from "@/client/lib/photo/decode-image.ts";
import { supportsCanvasFilter } from "@/client/lib/photo/filter-support.ts";
import { type ProcessedPhoto, processPhoto } from "@/client/lib/photo/process.ts";
import { supportsBackgroundRemoval } from "@/client/lib/photo/remove-background.ts";
import { getColorCorrectionPref, getCutoutPref } from "@/client/lib/preferences.ts";

/**
 * まとめて追加のライブラリ複数選択用。photo-edit を挟まず、中央・拡縮 1 でセラー処理する。
 */
export async function processCellarFile(
  file: File,
  onRecognizeJpeg?: (jpeg: Blob) => void,
): Promise<ProcessedPhoto> {
  const source = await decodeImage(file);
  try {
    return await processPhoto({
      source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      kind: "cellar",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      filterOn: getColorCorrectionPref() && supportsCanvasFilter(),
      mascotOn: false,
      cutoutOn: getCutoutPref() && supportsBackgroundRemoval(),
      onRecognizeJpeg,
    });
  } finally {
    source.close();
  }
}

export function takeFilesForBatch(files: readonly File[], remaining: number): File[] {
  if (remaining <= 0) {
    return [];
  }
  return files.slice(0, remaining);
}
