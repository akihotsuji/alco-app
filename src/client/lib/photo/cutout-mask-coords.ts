import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";

export type ContainRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  fitScale: number;
};

export type MaskViewTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export type CssRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function createMaskViewTransform(): MaskViewTransform {
  return { scale: 1, panX: 0, panY: 0 };
}

export function clampMaskZoom(scale: number): number {
  return Math.min(PHOTO_CUTOUT_MASK_EDIT.zoomMax, Math.max(PHOTO_CUTOUT_MASK_EDIT.zoomMin, scale));
}

export function containRect(
  viewportWidth: number,
  viewportHeight: number,
  roiWidth: number,
  roiHeight: number,
): ContainRect {
  if (viewportWidth <= 0 || viewportHeight <= 0 || roiWidth <= 0 || roiHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, fitScale: 1 };
  }
  const fitScale = Math.min(viewportWidth / roiWidth, viewportHeight / roiHeight);
  const width = roiWidth * fitScale;
  const height = roiHeight * fitScale;
  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
    fitScale,
  };
}

export function clampMaskView(view: MaskViewTransform, contain: ContainRect): MaskViewTransform {
  const scale = clampMaskZoom(view.scale);
  const drawnW = contain.width * scale;
  const drawnH = contain.height * scale;
  const maxX = Math.max(0, (drawnW - contain.width) / 2 + contain.width * 0.45);
  const maxY = Math.max(0, (drawnH - contain.height) / 2 + contain.height * 0.45);
  return {
    scale,
    panX: Math.min(maxX, Math.max(-maxX, view.panX)),
    panY: Math.min(maxY, Math.max(-maxY, view.panY)),
  };
}

/**
 * client（CSS px）→ ROI 画素。contain 余白・ズーム・パンを逆変換する。
 * Canvas の backing サイズではなく表示矩形を使う。
 */
export function clientToRoiPixel(
  clientX: number,
  clientY: number,
  viewport: CssRect,
  contain: ContainRect,
  view: MaskViewTransform,
  roiWidth: number,
  roiHeight: number,
): { x: number; y: number } | null {
  if (viewport.width <= 0 || viewport.height <= 0 || contain.width <= 0 || contain.height <= 0) {
    return null;
  }
  const localX = clientX - viewport.left;
  const localY = clientY - viewport.top;
  const centerX = contain.x + contain.width / 2;
  const centerY = contain.y + contain.height / 2;
  const u = (localX - centerX - view.panX) / view.scale + contain.width / 2;
  const v = (localY - centerY - view.panY) / view.scale + contain.height / 2;
  if (u < 0 || v < 0 || u >= contain.width || v >= contain.height) {
    return null;
  }
  return {
    x: (u / contain.width) * roiWidth,
    y: (v / contain.height) * roiHeight,
  };
}

export function screenBrushRadiusToRoi(
  radiusCss: number,
  contain: ContainRect,
  viewScale: number,
): number {
  const denom = contain.fitScale * viewScale;
  if (denom <= 0) {
    return radiusCss;
  }
  return radiusCss / denom;
}

export function zoomMaskView(
  view: MaskViewTransform,
  nextScale: number,
  originX: number,
  originY: number,
  contain: ContainRect,
): MaskViewTransform {
  const scale = clampMaskZoom(nextScale);
  if (scale === view.scale) {
    return clampMaskView(view, contain);
  }
  const centerX = contain.x + contain.width / 2;
  const centerY = contain.y + contain.height / 2;
  const ratio = scale / view.scale;
  return clampMaskView(
    {
      scale,
      panX: (view.panX + originX - centerX) * ratio - (originX - centerX),
      panY: (view.panY + originY - centerY) * ratio - (originY - centerY),
    },
    contain,
  );
}

export function panMaskView(
  view: MaskViewTransform,
  deltaX: number,
  deltaY: number,
  contain: ContainRect,
): MaskViewTransform {
  return clampMaskView(
    {
      scale: view.scale,
      panX: view.panX + deltaX,
      panY: view.panY + deltaY,
    },
    contain,
  );
}

export function fitMaskView(): MaskViewTransform {
  return createMaskViewTransform();
}
