import { PHOTO_ASPECT } from "@/shared/constants.ts";
import { applyPreset, type ColorPreset } from "./apply-preset.ts";
import { composeMascot } from "./compose-mascot.ts";
import { cropResize } from "./crop-resize.ts";
import { type AspectRatio, computeCoverCrop, outputSizeForAspect } from "./geometry.ts";
import { removeBackground, supportsBackgroundRemoval } from "./remove-background.ts";
import { toJpegBlob, toWebpBlob } from "./to-jpeg-blob.ts";

export type PhotoProcessKind = "log" | "cellar" | "note";

export type ProcessPhotoInput = {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  kind: PhotoProcessKind;
  scale: number;
  offsetX: number;
  offsetY: number;
  filterOn: boolean;
  mascotOn: boolean;
  cutoutOn: boolean;
};

export type ProcessedPhoto = {
  blob: Blob;
  previewUrl: string;
  recognizeJpeg?: Blob;
};

export function presetForKind(kind: PhotoProcessKind, filterOn: boolean): ColorPreset {
  if (!filterOn) {
    return "none";
  }
  return kind === "cellar" ? "cellar" : "table";
}

export function aspectForEditKind(kind: PhotoProcessKind): AspectRatio {
  return kind === "cellar" ? PHOTO_ASPECT.cellar : PHOTO_ASPECT.log;
}

export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessedPhoto> {
  const aspect = aspectForEditKind(input.kind);
  const crop = computeCoverCrop({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    aspect,
    scale: input.scale,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
  });
  const output = outputSizeForAspect(aspect);
  let canvas = cropResize(input.source, crop, output);
  canvas = applyPreset(canvas, presetForKind(input.kind, input.filterOn));

  let recognizeJpeg: Blob | undefined;
  if (input.kind === "cellar") {
    recognizeJpeg = await toJpegBlob(canvas);
    if (input.cutoutOn && supportsBackgroundRemoval()) {
      try {
        const cut = await removeBackground(canvas);
        canvas = cut;
        const blob = await toWebpBlob(canvas);
        return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg };
      } catch {
        // 長方形 JPEG へフォールバック
      }
    }
    const blob = await toJpegBlob(canvas);
    return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg };
  }

  if (input.mascotOn) {
    canvas = await composeMascot(canvas);
  }
  const blob = await toJpegBlob(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob) };
}
