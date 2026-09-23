import { cropResize } from "./crop-resize.ts";
import { workImageSize } from "./cutout-roi.ts";
import { fitToLongEdge, resizeKeepAspect } from "./geometry.ts";
import {
  findLabelRect,
  type LabelCropResult,
  luminanceFromRgba,
  rectToPixels,
} from "./label-crop.ts";
import { segmentBottle } from "./remove-background.ts";

/**
 * 裏面写真からラベルの矩形を探す。瓶マスクは背景除去と同じモデルで求める。
 * 推論できない・瓶が見つからないときは null（呼び出し側は中央 2:3 に戻す）。
 */
export async function detectBackLabel(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<LabelCropResult | null> {
  const work = resizeKeepAspect(
    source,
    sourceWidth,
    sourceHeight,
    workImageSize(sourceWidth, sourceHeight),
  );
  let segmentation: Awaited<ReturnType<typeof segmentBottle>>;
  try {
    segmentation = await segmentBottle(work, { queue: "fifo" });
  } catch {
    return null;
  }
  const size = segmentation.modelSize;
  const grid = cropResize(
    work,
    { sx: 0, sy: 0, sw: work.width, sh: work.height },
    {
      width: size,
      height: size,
    },
  );
  const ctx = grid.getContext("2d");
  if (!ctx) {
    return null;
  }
  const pixels = ctx.getImageData(0, 0, size, size);
  return findLabelRect({
    luminance: luminanceFromRgba(pixels.data, size * size),
    mask: segmentation.mask,
    width: size,
    height: size,
  });
}

/** 見つけた矩形で元画像を切り、長辺を揃えたキャンバスにする */
export function cropToLabel(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  result: LabelCropResult,
): HTMLCanvasElement {
  const crop = rectToPixels(result.rect, sourceWidth, sourceHeight);
  return cropResize(source, crop, fitToLongEdge(crop.sw, crop.sh));
}
