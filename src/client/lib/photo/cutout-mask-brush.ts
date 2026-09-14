import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";
import { expandRect, type MaskRect } from "./cutout-mask-buffer.ts";

export type MaskBrushTool = "restore" | "erase";

export type MaskBrushPoint = {
  x: number;
  y: number;
};

/** 中心は完全、縁は狭いアンチエイリアス。半径 0 以下は塗らない */
export function brushCoverage(
  distance: number,
  radius: number,
  softPx = PHOTO_CUTOUT_MASK_EDIT.brushSoftPx,
): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  const inner = Math.max(0, radius - Math.max(0.25, softPx));
  if (distance <= inner) {
    return 1;
  }
  return 1 - (distance - inner) / (radius - inner);
}

export function applyBrushCoverage(current: number, coverage: number, tool: MaskBrushTool): number {
  if (coverage <= 0) {
    return current;
  }
  if (tool === "restore") {
    return Math.max(current, Math.round(255 * coverage));
  }
  return Math.min(current, Math.round(255 * (1 - coverage)));
}

function stampCircle(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  tool: MaskBrushTool,
): MaskRect | null {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  if (maxX < minX || maxY < minY) {
    return null;
  }
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const coverage = brushCoverage(Math.hypot(x + 0.5 - cx, y + 0.5 - cy), radius);
      if (coverage <= 0) {
        continue;
      }
      const index = y * width + x;
      mask[index] = applyBrushCoverage(mask[index] ?? 0, coverage, tool);
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** 2 点間を円とカプセルで補間し、速い pointermove でも点線にしない */
export function stampBrushStroke(
  mask: Uint8Array,
  width: number,
  height: number,
  from: MaskBrushPoint | null,
  to: MaskBrushPoint,
  radius: number,
  tool: MaskBrushTool,
): MaskRect | null {
  if (to.x < -radius || to.y < -radius || to.x > width + radius || to.y > height + radius) {
    if (!from) {
      return null;
    }
  }
  let dirty = stampCircle(mask, width, height, to.x, to.y, radius, tool);
  if (!from) {
    return dirty;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.5) {
    return dirty;
  }
  const step = Math.max(0.5, radius * 0.35);
  const count = Math.ceil(distance / step);
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const next = stampCircle(mask, width, height, from.x + dx * t, from.y + dy * t, radius, tool);
    if (next) {
      dirty = expandRect(
        dirty,
        next.x,
        next.y,
        next.x + next.width - 1,
        next.y + next.height - 1,
        width,
        height,
      );
    }
  }
  const start = stampCircle(mask, width, height, from.x, from.y, radius, tool);
  if (start) {
    dirty = expandRect(
      dirty,
      start.x,
      start.y,
      start.x + start.width - 1,
      start.y + start.height - 1,
      width,
      height,
    );
  }
  return dirty;
}

export function clampBrushRadius(radius: number): number {
  return Math.min(
    PHOTO_CUTOUT_MASK_EDIT.brushRadiusMax,
    Math.max(PHOTO_CUTOUT_MASK_EDIT.brushRadiusMin, Math.round(radius)),
  );
}
