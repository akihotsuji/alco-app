import { PHOTO_CELLAR_VIGNETTE, PHOTO_FILTERS } from "@/shared/constants.ts";
import { supportsCanvasFilter } from "./filter-support.ts";

export type ColorPreset = "table" | "cellar" | "none";

export function applyPreset(canvas: HTMLCanvasElement, preset: ColorPreset): HTMLCanvasElement {
  if (preset === "none" || !supportsCanvasFilter()) {
    return canvas;
  }
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.filter = PHOTO_FILTERS[preset];
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";
  if (preset === "cellar") {
    applyVignette(ctx, out.width, out.height);
  }
  return out;
}

function applyVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);
  const inner = outer * PHOTO_CELLAR_VIGNETTE.radius;
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${PHOTO_CELLAR_VIGNETTE.opacity})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
