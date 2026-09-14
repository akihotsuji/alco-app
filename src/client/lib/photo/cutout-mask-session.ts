import { PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";
import { type MaskBrushPoint, type MaskBrushTool, stampBrushStroke } from "./cutout-mask-brush.ts";
import {
  type CutoutWorkMask,
  copyMaskBytes,
  copyWorkMask,
  expandRect,
  isSelectionMaskEmpty,
  type MaskRect,
} from "./cutout-mask-buffer.ts";
import {
  createFullDiffPatch,
  createMaskHistory,
  createRectPatch,
  type MaskHistory,
  pushMaskPatch,
  redoMaskHistory,
  snapshotMask,
  undoMaskHistory,
} from "./cutout-mask-history.ts";

export type MaskEditTool = MaskBrushTool | "pan";

export type MaskEditSession = {
  width: number;
  height: number;
  sourceAlpha: Uint8Array;
  baseMask: Uint8Array;
  committedMask: Uint8Array;
  draftMask: Uint8Array;
  revision: number;
  history: MaskHistory;
  strokeBefore: Uint8Array | null;
  strokeDirty: MaskRect | null;
  lastPoint: MaskBrushPoint | null;
  strokeViewScale: number;
};

export function createMaskEditSession(input: {
  width: number;
  height: number;
  sourceAlpha: Uint8Array;
  baseMask: Uint8Array;
  committedMask: Uint8Array;
  revision?: number;
}): MaskEditSession {
  const length = input.width * input.height;
  if (
    input.sourceAlpha.length !== length ||
    input.baseMask.length !== length ||
    input.committedMask.length !== length
  ) {
    throw new Error("cutout_mask_size");
  }
  return {
    width: input.width,
    height: input.height,
    sourceAlpha: copyMaskBytes(input.sourceAlpha),
    baseMask: copyMaskBytes(input.baseMask),
    committedMask: copyMaskBytes(input.committedMask),
    draftMask: copyMaskBytes(input.committedMask),
    revision: input.revision ?? 0,
    history: createMaskHistory(),
    strokeBefore: null,
    strokeDirty: null,
    lastPoint: null,
    strokeViewScale: 1,
  };
}

export function beginMaskStroke(
  session: MaskEditSession,
  point: MaskBrushPoint,
  radius: number,
  tool: MaskBrushTool,
  viewScale: number,
): MaskRect | null {
  session.strokeBefore = snapshotMask(session.draftMask);
  session.strokeDirty = null;
  session.lastPoint = null;
  session.strokeViewScale = viewScale;
  return continueMaskStroke(session, point, radius, tool);
}

export function continueMaskStroke(
  session: MaskEditSession,
  point: MaskBrushPoint,
  radius: number,
  tool: MaskBrushTool,
): MaskRect | null {
  const dirty = stampBrushStroke(
    session.draftMask,
    session.width,
    session.height,
    session.lastPoint,
    point,
    radius,
    tool,
  );
  session.lastPoint = point;
  if (dirty) {
    session.strokeDirty = expandRect(
      session.strokeDirty,
      dirty.x,
      dirty.y,
      dirty.x + dirty.width - 1,
      dirty.y + dirty.height - 1,
      session.width,
      session.height,
    );
  }
  return dirty;
}

export function commitMaskStroke(session: MaskEditSession): boolean {
  if (!session.strokeBefore || !session.strokeDirty) {
    session.strokeBefore = null;
    session.strokeDirty = null;
    session.lastPoint = null;
    return false;
  }
  const patch = createRectPatch(
    session.strokeBefore,
    session.draftMask,
    session.width,
    session.strokeDirty,
  );
  session.strokeBefore = null;
  session.strokeDirty = null;
  session.lastPoint = null;
  if (!patch) {
    return false;
  }
  pushMaskPatch(session.history, patch);
  session.revision += 1;
  return true;
}

export function cancelMaskStroke(session: MaskEditSession): boolean {
  if (!session.strokeBefore) {
    session.strokeDirty = null;
    session.lastPoint = null;
    return false;
  }
  session.draftMask.set(session.strokeBefore);
  session.strokeBefore = null;
  session.strokeDirty = null;
  session.lastPoint = null;
  session.revision += 1;
  return true;
}

export function undoMaskEdit(session: MaskEditSession): boolean {
  if (session.strokeBefore) {
    return false;
  }
  if (!undoMaskHistory(session.history, session.draftMask, session.width)) {
    return false;
  }
  session.revision += 1;
  return true;
}

export function redoMaskEdit(session: MaskEditSession): boolean {
  if (session.strokeBefore) {
    return false;
  }
  if (!redoMaskHistory(session.history, session.draftMask, session.width)) {
    return false;
  }
  session.revision += 1;
  return true;
}

export function resetMaskEdit(session: MaskEditSession): boolean {
  if (session.strokeBefore) {
    cancelMaskStroke(session);
  }
  const patch = createFullDiffPatch(
    session.draftMask,
    session.baseMask,
    session.width,
    session.height,
  );
  if (!patch) {
    return false;
  }
  session.draftMask.set(session.baseMask);
  pushMaskPatch(session.history, patch);
  session.revision += 1;
  return true;
}

export function revertDraftToCommitted(session: MaskEditSession): void {
  cancelMaskStroke(session);
  session.draftMask.set(session.committedMask);
  session.history = createMaskHistory();
  session.revision += 1;
}

export function commitDraftToCommitted(session: MaskEditSession): CutoutWorkMask {
  cancelMaskStroke(session);
  session.committedMask.set(session.draftMask);
  session.history = createMaskHistory();
  session.revision += 1;
  return {
    width: session.width,
    height: session.height,
    data: copyMaskBytes(session.committedMask),
  };
}

export function draftWorkMask(session: MaskEditSession): CutoutWorkMask {
  return { width: session.width, height: session.height, data: session.draftMask };
}

export function committedWorkMask(session: MaskEditSession): CutoutWorkMask {
  return copyWorkMask({
    width: session.width,
    height: session.height,
    data: session.committedMask,
  });
}

export function hasDraftChanges(session: MaskEditSession): boolean {
  if (session.strokeBefore) {
    return true;
  }
  for (let i = 0; i < session.draftMask.length; i += 1) {
    if (session.draftMask[i] !== session.committedMask[i]) {
      return true;
    }
  }
  return false;
}

export function hasManualEdits(committed: Uint8Array, base: Uint8Array): boolean {
  if (committed.length !== base.length) {
    return true;
  }
  for (let i = 0; i < committed.length; i += 1) {
    if (committed[i] !== base[i]) {
      return true;
    }
  }
  return false;
}

export function isDraftEmpty(session: MaskEditSession): boolean {
  return isSelectionMaskEmpty(session.draftMask);
}

export function canUndoMask(session: MaskEditSession): boolean {
  return !session.strokeBefore && session.history.undo.length > 0;
}

export function canRedoMask(session: MaskEditSession): boolean {
  return !session.strokeBefore && session.history.redo.length > 0;
}

export function maskHistoryLimits(): { maxStrokes: number; maxBytes: number } {
  return {
    maxStrokes: PHOTO_CUTOUT_MASK_EDIT.historyMaxStrokes,
    maxBytes: PHOTO_CUTOUT_MASK_EDIT.historyMaxBytes,
  };
}
