import type { CropRect, OutputSize } from "./geometry.ts";

export function cropResize(
  source: CanvasImageSource,
  crop: CropRect,
  output: OutputSize,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height);
  return canvas;
}
