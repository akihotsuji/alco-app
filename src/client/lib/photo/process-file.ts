import { capturedAtFromFile } from "@/client/lib/photo/captured-at.ts";
import { pickMascotPose } from "@/client/lib/photo/compose-mascot.ts";
import { decodeImage } from "@/client/lib/photo/decode-image.ts";
import { fitToLongEdge, resizeKeepAspect } from "@/client/lib/photo/geometry.ts";
import { type ProcessedPhoto, processLogPhoto, processPhoto } from "@/client/lib/photo/process.ts";
import { toJpegBlobWithinLimit } from "@/client/lib/photo/to-jpeg-blob.ts";
import { supportsBackgroundRemoval } from "@/client/lib/photo/remove-background.ts";
import { getComposeMascotPref, getCutoutPref } from "@/client/lib/preferences.ts";

/**
 * まとめて追加のライブラリ複数選択用。photo-edit を挟まず、中央・拡縮 1 でセラー処理する。
 */
export async function processCellarFile(
  file: File,
  onRecognizeJpeg?: (jpeg: Blob) => void,
): Promise<ProcessedPhoto> {
  const capturedAt = (await capturedAtFromFile(file)) ?? undefined;
  const source = await decodeImage(file);
  try {
    const processed = await processPhoto({
      source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      kind: "cellar",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mascotOn: false,
      cutoutOn: getCutoutPref() && supportsBackgroundRemoval(),
      onRecognizeJpeg,
    });
    return { ...processed, capturedAt };
  } finally {
    source.close();
  }
}

/**
 * ボトル裏面用（04-cellar B1b / G2b）。photo-edit を挟まず、中央・拡縮 1 で 2:3 に切った JPEG にする。
 * 切り抜き・キャラ合成は掛けない（常に `kind = photo`）。読み取り用 JPEG も表面と同じ規格で作る。
 */
export async function processBackPhotoFile(
  file: File,
  onRecognizeJpeg?: (jpeg: Blob) => void,
): Promise<ProcessedPhoto> {
  const capturedAt = (await capturedAtFromFile(file)) ?? undefined;
  const source = await decodeImage(file);
  try {
    const processed = await processPhoto({
      source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      kind: "cellar",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mascotOn: false,
      cutoutOn: false,
      onRecognizeJpeg,
    });
    return { ...processed, capturedAt };
  } finally {
    source.close();
  }
}

/**
 * ノートの撮影・ライブラリ選択用。photo-edit の「使う」を挟まず、中央・拡縮 1 で 4:5 に切り、
 * 設定どおりキャラを合成する（05-notes.md N1）。位置を直したいときはサムネの「編集」から photo-edit を開く。
 */
export async function processNoteFile(
  file: File,
  onRecognizeJpeg?: (jpeg: Blob) => void,
): Promise<ProcessedPhoto> {
  const capturedAt = (await capturedAtFromFile(file)) ?? undefined;
  const source = await decodeImage(file);
  try {
    const processed = await processPhoto({
      source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      kind: "note",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mascotOn: getComposeMascotPref(),
      mascotPose: pickMascotPose(),
      cutoutOn: false,
      onRecognizeJpeg,
    });
    return { ...processed, capturedAt };
  } finally {
    source.close();
  }
}

export async function processLogFile(
  file: File,
  onRecognizeJpeg?: (jpeg: Blob) => void,
): Promise<ProcessedPhoto> {
  const capturedAt = (await capturedAtFromFile(file)) ?? undefined;
  const source = await decodeImage(file);
  try {
    return await processLogPhoto({
      source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      mascotOn: getComposeMascotPref(),
      capturedAt,
      onRecognizeJpeg,
    });
  } finally {
    source.close();
  }
}

/** ご意見添付。切り抜き・キャラ合成なし。長辺だけ揃えて JPEG にする */
export async function processFeedbackFile(file: File): Promise<ProcessedPhoto> {
  const source = await decodeImage(file);
  try {
    const output = fitToLongEdge(source.width, source.height);
    const canvas = resizeKeepAspect(source, source.width, source.height, output);
    const blob = await toJpegBlobWithinLimit(canvas);
    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
    };
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
