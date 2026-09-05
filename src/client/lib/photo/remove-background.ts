import { PHOTO_CUTOUT_SHADOW } from "@/shared/constants.ts";
import { supportsWasmSimd } from "./filter-support.ts";
import { computeCutoutPlacement } from "./geometry.ts";

export type RemoveBackgroundProgress = {
  percent?: number;
  firstDownload: boolean;
};

/**
 * 4-06 で WASM 実装に差し替える。2-08 は差し込み口のみ。
 * SIMD が無い端末では呼び出さない（トグル非表示）。
 */
export function supportsBackgroundRemoval(): boolean {
  return typeof WebAssembly !== "undefined" && supportsWasmSimd() && Boolean(loadRemover());
}

function loadRemover(): null {
  return null;
}

export async function removeBackground(
  _source: CanvasImageSource,
  _onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<HTMLCanvasElement> {
  throw new Error("not_implemented");
}

export function paintCutoutOnCanvas(
  cutout: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  dest: HTMLCanvasElement,
): HTMLCanvasElement {
  const ctx = dest.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.clearRect(0, 0, dest.width, dest.height);
  const placed = computeCutoutPlacement({
    sourceWidth,
    sourceHeight,
    canvasWidth: dest.width,
    canvasHeight: dest.height,
  });
  ctx.fillStyle = PHOTO_CUTOUT_SHADOW.color;
  ctx.beginPath();
  ctx.ellipse(
    placed.shadow.x,
    placed.shadow.y,
    placed.shadow.rx,
    placed.shadow.ry,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.drawImage(cutout, placed.x, placed.y, placed.width, placed.height);
  return dest;
}
