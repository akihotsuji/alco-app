import { applyPreset, type ColorPreset } from "./apply-preset.ts";
import { composeMascot } from "./compose-mascot.ts";
import { cropResize } from "./crop-resize.ts";
import { aspectForKind, computeCoverCrop, outputSizeForAspect } from "./geometry.ts";
import {
  paintCutoutOnCanvas,
  type RemoveBackgroundProgress,
  removeBackground,
  supportsBackgroundRemoval,
} from "./remove-background.ts";
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
  onCutoutProgress?: (progress: RemoveBackgroundProgress) => void;
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

export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessedPhoto> {
  const aspect = aspectForKind(input.kind);
  const crop = computeCoverCrop({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    aspect,
    scale: input.scale,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
  });
  const output = outputSizeForAspect(aspect);
  const cropped = cropResize(input.source, crop, output);
  const preset = presetForKind(input.kind, input.filterOn);

  if (input.kind === "cellar") {
    const filtered = applyPreset(cropped, preset);
    const recognizeJpeg = await toJpegBlob(filtered);
    if (input.cutoutOn && supportsBackgroundRemoval()) {
      try {
        const removed = await removeBackground(cropped, input.onCutoutProgress);
        const colored = applyPreset(removed, preset, { vignette: false });
        const dest = document.createElement("canvas");
        dest.width = output.width;
        dest.height = output.height;
        paintCutoutOnCanvas(colored, dest);
        const blob = await toWebpBlob(dest);
        if (blob.type === "image/webp") {
          return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg };
        }
      } catch {
        // 長方形 JPEG へフォールバック
      }
    }
    const blob = await toJpegBlob(filtered);
    return { blob, previewUrl: URL.createObjectURL(blob), recognizeJpeg };
  }

  let canvas = applyPreset(cropped, preset);
  if (input.mascotOn) {
    canvas = await composeMascot(canvas);
  }
  const blob = await toJpegBlob(canvas);
  return { blob, previewUrl: URL.createObjectURL(blob) };
}
