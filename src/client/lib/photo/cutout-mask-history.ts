import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";
import { copyMaskBytes, copyMaskRect, type MaskRect, writeMaskRect } from "./cutout-mask-buffer.ts";

export type MaskHistoryPatch = {
  rect: MaskRect;
  before: Uint8Array;
  after: Uint8Array;
};

export type MaskHistory = {
  undo: MaskHistoryPatch[];
  redo: MaskHistoryPatch[];
  bytes: number;
};

export function createMaskHistory(): MaskHistory {
  return { undo: [], redo: [], bytes: 0 };
}

function patchBytes(patch: MaskHistoryPatch): number {
  return patch.before.byteLength + patch.after.byteLength;
}

function dropOldest(history: MaskHistory): void {
  const oldest = history.undo.shift();
  if (!oldest) {
    return;
  }
  history.bytes -= patchBytes(oldest);
}

export function pushMaskPatch(
  history: MaskHistory,
  patch: MaskHistoryPatch,
  limits: { maxStrokes: number; maxBytes: number } = {
    maxStrokes: PHOTO_CUTOUT_MASK_EDIT.historyMaxStrokes,
    maxBytes: PHOTO_CUTOUT_MASK_EDIT.historyMaxBytes,
  },
): void {
  if (patch.rect.width <= 0 || patch.rect.height <= 0) {
    return;
  }
  for (const discarded of history.redo) {
    history.bytes -= patchBytes(discarded);
  }
  history.redo = [];
  history.undo.push(patch);
  history.bytes += patchBytes(patch);
  while (history.undo.length > limits.maxStrokes || history.bytes > limits.maxBytes) {
    if (history.undo.length <= 1) {
      break;
    }
    dropOldest(history);
  }
}

export function applyPatch(
  mask: Uint8Array,
  width: number,
  patch: MaskHistoryPatch,
  side: "before" | "after",
): void {
  writeMaskRect(mask, width, patch.rect, side === "before" ? patch.before : patch.after);
}

export function undoMaskHistory(history: MaskHistory, mask: Uint8Array, width: number): boolean {
  const patch = history.undo.pop();
  if (!patch) {
    return false;
  }
  applyPatch(mask, width, patch, "before");
  history.redo.push(patch);
  return true;
}

export function redoMaskHistory(history: MaskHistory, mask: Uint8Array, width: number): boolean {
  const patch = history.redo.pop();
  if (!patch) {
    return false;
  }
  applyPatch(mask, width, patch, "after");
  history.undo.push(patch);
  return true;
}

export function createRectPatch(
  beforeMask: Uint8Array,
  afterMask: Uint8Array,
  width: number,
  rect: MaskRect,
): MaskHistoryPatch | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    rect: { ...rect },
    before: copyMaskRect(beforeMask, width, rect),
    after: copyMaskRect(afterMask, width, rect),
  };
}

export function createFullDiffPatch(
  beforeMask: Uint8Array,
  afterMask: Uint8Array,
  width: number,
  height: number,
): MaskHistoryPatch | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (beforeMask[i] !== afterMask[i]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    return null;
  }
  return createRectPatch(beforeMask, afterMask, width, {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });
}

export function snapshotMask(mask: Uint8Array): Uint8Array {
  return copyMaskBytes(mask);
}
