import { afterEach, describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_MASK, PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";
import { applyBrushCoverage, brushCoverage, stampBrushStroke } from "./cutout-mask-brush.ts";
import {
  applyComposedAlpha,
  composeSelectionWithSourceAlpha,
  copyMaskBytes,
  inspectCommittedMask,
  isSelectionMaskEmpty,
  opaqueSelectionBox,
  snapshotCommittedMask,
} from "./cutout-mask-buffer.ts";
import {
  clientToRoiPixel,
  containRect,
  createMaskViewTransform,
  screenBrushRadiusToRoi,
  zoomMaskView,
} from "./cutout-mask-coords.ts";
import { createFullDiffPatch, createMaskHistory, pushMaskPatch } from "./cutout-mask-history.ts";
import {
  clearAllCutoutMaskHolds,
  clearCutoutMaskHoldsForSession,
  cutoutMaskHoldCount,
  getCutoutMaskHold,
  putCutoutMaskHold,
} from "./cutout-mask-hold.ts";
import {
  beginMaskPointer,
  cancelMaskPointers,
  createMaskPointerState,
  endMaskPointer,
  moveMaskPointer,
} from "./cutout-mask-pointers.ts";
import {
  beginMaskStroke,
  canRedoMask,
  canUndoMask,
  commitDraftToCommitted,
  commitMaskStroke,
  continueMaskStroke,
  createMaskEditSession,
  hasDraftChanges,
  hasManualEdits,
  isDraftEmpty,
  resetMaskEdit,
  revertDraftToCommitted,
  undoMaskEdit,
} from "./cutout-mask-session.ts";
import { rotateRgbaAndMask, trimTransparent } from "./cutout-rotate.ts";

function fillRect(
  mask: Uint8Array,
  width: number,
  rect: { x: number; y: number; w: number; h: number },
  value: number,
): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      mask[y * width + x] = value;
    }
  }
}

function paintRgb(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
  color: [number, number, number],
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

describe("brushCoverage / applyBrushCoverage", () => {
  it("中心は完全復元・完全消去で、自動マスク値へは戻さない", () => {
    expect(brushCoverage(0, 8)).toBe(1);
    expect(applyBrushCoverage(0, 1, "restore")).toBe(255);
    expect(applyBrushCoverage(40, 1, "restore")).toBe(255);
    expect(applyBrushCoverage(200, 1, "erase")).toBe(0);
    expect(applyBrushCoverage(0, 1, "erase")).toBe(0);
  });

  it("同じ場所を重ねても復元は 255、消去は 0 で頭打ち", () => {
    let value = 10;
    value = applyBrushCoverage(value, 0.4, "restore");
    const once = value;
    value = applyBrushCoverage(value, 0.4, "restore");
    expect(value).toBe(once);
    expect(value).toBe(Math.round(255 * 0.4));
    value = applyBrushCoverage(200, 0.4, "erase");
    const erased = value;
    value = applyBrushCoverage(value, 0.4, "erase");
    expect(value).toBe(erased);
    expect(value).toBe(Math.round(255 * 0.6));
  });

  it("縁は 0 と 1 の間の狭いアンチエイリアス", () => {
    const edge = brushCoverage(7.4, 8);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    expect(brushCoverage(8, 8)).toBe(0);
  });
});

describe("stampBrushStroke", () => {
  it("間隔の広い pointermove でも連続線になり、単点も残る", () => {
    const width = 80;
    const height = 40;
    const mask = new Uint8Array(width * height);
    stampBrushStroke(mask, width, height, null, { x: 10, y: 20 }, 4, "restore");
    expect(mask[20 * width + 10]).toBe(255);
    stampBrushStroke(mask, width, height, { x: 10, y: 20 }, { x: 50, y: 20 }, 4, "restore");
    let opaque = 0;
    for (let x = 10; x <= 50; x += 1) {
      if ((mask[20 * width + x] ?? 0) > 200) {
        opaque += 1;
      }
    }
    expect(opaque).toBeGreaterThan(30);
  });

  it("なぞっていない画素は変えない", () => {
    const width = 20;
    const height = 20;
    const mask = new Uint8Array(width * height);
    mask.fill(80);
    stampBrushStroke(mask, width, height, null, { x: 4, y: 4 }, 3, "erase");
    expect(mask[18 * width + 18]).toBe(80);
    expect(mask[4 * width + 4]).toBe(0);
  });
});

describe("完全欠けの復元と合成", () => {
  it("底を 0 にした base から復元すると元 RGB が出て、trim で切れない", () => {
    const width = 24;
    const height = 48;
    const body = { x: 8, y: 4, w: 8, h: 28 };
    const bottom = { x: 8, y: 32, w: 8, h: 10 };
    const rgba = paintRgb(width, height, { x: 8, y: 4, w: 8, h: 38 }, [20, 10, 8]);
    const sourceAlpha = new Uint8Array(width * height).fill(255);
    const selection = new Uint8Array(width * height);
    fillRect(selection, width, body, 255);
    expect(selection[36 * width + 12]).toBe(0);
    stampBrushStroke(selection, width, height, { x: 12, y: 30 }, { x: 12, y: 40 }, 5, "restore");
    expect(selection[36 * width + 12]).toBe(255);
    applyComposedAlpha(rgba, selection, sourceAlpha);
    expect(rgba[(36 * width + 12) * 4]).toBe(20);
    expect(rgba[(36 * width + 12) * 4 + 3]).toBe(255);
    const trimmed = trimTransparent(
      rotateRgbaAndMask({
        rgba,
        mask: composeSelectionWithSourceAlpha(selection, sourceAlpha),
        width,
        height,
        degrees: 0,
      }),
    );
    const box = opaqueSelectionBox(trimmed.mask, trimmed.width, trimmed.height);
    expect(box).not.toBeNull();
    expect((box?.height ?? 0) + (box?.y ?? 0)).toBeGreaterThan(bottom.y + 4);
  });

  it("角度を付けても復元した底が trim 後に残る", () => {
    const width = 24;
    const height = 48;
    const rgba = paintRgb(width, height, { x: 8, y: 4, w: 8, h: 38 }, [20, 10, 8]);
    const sourceAlpha = new Uint8Array(width * height).fill(255);
    const selection = new Uint8Array(width * height);
    fillRect(selection, width, { x: 8, y: 4, w: 8, h: 28 }, 255);
    stampBrushStroke(selection, width, height, { x: 12, y: 30 }, { x: 12, y: 40 }, 5, "restore");
    applyComposedAlpha(rgba, selection, sourceAlpha);
    const rotated = trimTransparent(
      rotateRgbaAndMask({
        rgba,
        mask: composeSelectionWithSourceAlpha(selection, sourceAlpha),
        width,
        height,
        degrees: 8,
      }),
    );
    expect(
      opaqueSelectionBox(rotated.mask, rotated.width, rotated.height)?.height ?? 0,
    ).toBeGreaterThan(30);
  });
});

describe("source alpha", () => {
  it("入力本来の透明画素は復元しても不透明化しない。セッション内で消した有効画素は戻せる", () => {
    const selection = new Uint8Array([0, 0, 180]);
    const sourceAlpha = new Uint8Array([0, 200, 200]);
    const restored = new Uint8Array(selection);
    restored[0] = applyBrushCoverage(restored[0] ?? 0, 1, "restore");
    restored[1] = applyBrushCoverage(restored[1] ?? 0, 1, "erase");
    expect(composeSelectionWithSourceAlpha(restored, sourceAlpha)[0]).toBe(0);
    expect(composeSelectionWithSourceAlpha(restored, sourceAlpha)[1]).toBe(0);
    restored[1] = applyBrushCoverage(restored[1] ?? 0, 1, "restore");
    expect(composeSelectionWithSourceAlpha(restored, sourceAlpha)[1]).toBe(200);
  });
});

describe("座標変換", () => {
  it("contain 余白・ズーム・パン後も意図した ROI 画素へ写す", () => {
    const contain = containRect(200, 100, 40, 80);
    expect(contain.x).toBeGreaterThan(0);
    expect(contain.height).toBe(100);
    const view = createMaskViewTransform();
    const center = clientToRoiPixel(
      100,
      50,
      { left: 0, top: 0, width: 200, height: 100 },
      contain,
      view,
      40,
      80,
    );
    expect(center).not.toBeNull();
    expect(center?.x).toBeCloseTo(20, 5);
    expect(center?.y).toBeCloseTo(40, 5);
    expect(
      clientToRoiPixel(5, 50, { left: 0, top: 0, width: 200, height: 100 }, contain, view, 40, 80),
    ).toBeNull();

    const zoomed = zoomMaskView(view, 2, 100, 50, contain);
    const same = clientToRoiPixel(
      100,
      50,
      { left: 0, top: 0, width: 200, height: 100 },
      contain,
      zoomed,
      40,
      80,
    );
    expect(same?.x).toBeCloseTo(20, 5);
    expect(same?.y).toBeCloseTo(40, 5);

    const landscape = containRect(100, 200, 80, 40);
    const land = clientToRoiPixel(
      50,
      100,
      { left: 0, top: 0, width: 100, height: 200 },
      landscape,
      view,
      80,
      40,
    );
    expect(land?.x).toBeCloseTo(40, 5);
    expect(land?.y).toBeCloseTo(20, 5);
  });

  it("画面上のブラシ径はズームで ROI 上では細くなる", () => {
    const contain = containRect(200, 200, 100, 100);
    expect(screenBrushRadiusToRoi(20, contain, 1)).toBeCloseTo(10);
    expect(screenBrushRadiusToRoi(20, contain, 2)).toBeCloseTo(5);
  });
});

describe("履歴", () => {
  it("1 ストローク Undo/Redo、Redo 分岐、リセットが Undo できる", () => {
    const width = 16;
    const height = 16;
    const session = createMaskEditSession({
      width,
      height,
      sourceAlpha: new Uint8Array(width * height).fill(255),
      baseMask: new Uint8Array(width * height),
      committedMask: new Uint8Array(width * height),
    });
    beginMaskStroke(session, { x: 4, y: 4 }, 3, "restore", 1);
    commitMaskStroke(session);
    expect(session.draftMask[4 * width + 4]).toBe(255);
    beginMaskStroke(session, { x: 12, y: 12 }, 3, "restore", 1);
    commitMaskStroke(session);
    expect(canUndoMask(session)).toBe(true);
    undoMaskEdit(session);
    expect(session.draftMask[12 * width + 12]).toBe(0);
    expect(canRedoMask(session)).toBe(true);
    beginMaskStroke(session, { x: 8, y: 8 }, 3, "restore", 1);
    commitMaskStroke(session);
    expect(canRedoMask(session)).toBe(false);
    expect(session.draftMask[8 * width + 8]).toBe(255);
    resetMaskEdit(session);
    expect(session.draftMask[4 * width + 4]).toBe(0);
    undoMaskEdit(session);
    expect(session.draftMask[4 * width + 4]).toBe(255);
    const committed = commitDraftToCommitted(session);
    expect(hasManualEdits(committed.data, session.baseMask)).toBe(true);
    revertDraftToCommitted(session);
    expect(hasDraftChanges(session)).toBe(false);
  });

  it("容量上限を超えても現在のマスクは残す", () => {
    const history = createMaskHistory();
    const before = new Uint8Array(8);
    const after = new Uint8Array(8).fill(255);
    for (let i = 0; i < 8; i += 1) {
      const patch = createFullDiffPatch(before, after, 8, 1);
      expect(patch).not.toBeNull();
      if (patch) {
        pushMaskPatch(history, patch, { maxStrokes: 3, maxBytes: 64 });
      }
    }
    expect(history.undo.length).toBeLessThanOrEqual(3);
    expect(after[0]).toBe(255);
  });
});

describe("二本指と取消", () => {
  it("ピンチ開始で描画を取消し、全指が離れるまで描画しない", () => {
    const state = createMaskPointerState();
    expect(beginMaskPointer(state, 1, { x: 0, y: 0 }, "restore")).toMatchObject({ action: "draw" });
    expect(beginMaskPointer(state, 2, { x: 40, y: 0 }, "restore")).toEqual({
      action: "pinch-start",
      releaseCaptures: true,
      cancelStroke: true,
    });
    expect(moveMaskPointer(state, 2, { x: 80, y: 0 })?.type).toBe("pinch");
    expect(endMaskPointer(state, 2)).toEqual({ endStroke: false });
    expect(state.phase).toBe("blocked");
    expect(beginMaskPointer(state, 3, { x: 10, y: 10 }, "restore").action).not.toBe("draw");
    endMaskPointer(state, 1);
    endMaskPointer(state, 3);
    expect(state.phase).toBe("idle");
    expect(cancelMaskPointers(state)).toEqual({ cancelStroke: false });
    const drawing = createMaskPointerState();
    beginMaskPointer(drawing, 1, { x: 0, y: 0 }, "restore");
    expect(cancelMaskPointers(drawing)).toEqual({ cancelStroke: true });
  });
});

describe("キャッシュ隔離と同一性", () => {
  it("共有配列を直接書き換えず、別写真の hold を混ぜない", () => {
    const cached = new Uint8Array([1, 2, 3, 4]);
    const session = createMaskEditSession({
      width: 2,
      height: 2,
      sourceAlpha: new Uint8Array([255, 255, 255, 255]),
      baseMask: copyMaskBytes(cached),
      committedMask: copyMaskBytes(cached),
    });
    beginMaskStroke(session, { x: 0.5, y: 0.5 }, 2, "restore", 1);
    commitMaskStroke(session);
    expect(cached).toEqual(new Uint8Array([1, 2, 3, 4]));
    const identity = { sourceId: 1, segmentationKey: "a", width: 2, height: 2 };
    putCutoutMaskHold({
      formSessionId: "form-1",
      origin: "original",
      identity,
      sourceAlpha: new Uint8Array([255, 255, 255, 255]),
      baseMask: copyMaskBytes(cached),
      committed: snapshotCommittedMask(
        identity,
        { width: 2, height: 2, data: session.draftMask },
        1,
      ),
    });
    expect(getCutoutMaskHold("form-2", identity)).toBeNull();
    expect(getCutoutMaskHold("form-1", { ...identity, sourceId: 9 })).toBeNull();
    expect(getCutoutMaskHold("form-1", identity)?.committed.data[0]).toBe(255);
    clearCutoutMaskHoldsForSession("form-1");
    expect(cutoutMaskHoldCount()).toBe(0);
  });

  afterEach(() => {
    clearAllCutoutMaskHolds();
  });
});

describe("inspectCommittedMask / 全透明", () => {
  it("対象不一致と全透明を保存前に止める", () => {
    const identity = { sourceId: 1, segmentationKey: "k", width: 2, height: 2 };
    const empty = snapshotCommittedMask(
      identity,
      { width: 2, height: 2, data: new Uint8Array(4) },
      1,
    );
    expect(inspectCommittedMask(empty, identity)).toBe("empty");
    expect(isSelectionMaskEmpty(empty.data)).toBe(true);
    const filled = snapshotCommittedMask(
      identity,
      { width: 2, height: 2, data: new Uint8Array([0, 255, 0, 0]) },
      2,
    );
    expect(inspectCommittedMask(filled, { ...identity, segmentationKey: "other" })).toBe(
      "mismatch",
    );
    expect(inspectCommittedMask(filled, identity)).toBe("ok");
    const session = createMaskEditSession({
      width: 2,
      height: 2,
      sourceAlpha: new Uint8Array(4).fill(255),
      baseMask: new Uint8Array([255, 255, 0, 0]),
      committedMask: new Uint8Array([255, 255, 0, 0]),
    });
    beginMaskStroke(session, { x: 0.5, y: 0.5 }, 3, "erase", 1);
    continueMaskStroke(session, { x: 1.5, y: 0.5 }, 3, "erase");
    commitMaskStroke(session);
    expect(isDraftEmpty(session)).toBe(true);
  });
});

describe("定数", () => {
  it("履歴上限とズーム範囲を仕様どおり持つ", () => {
    expect(PHOTO_CUTOUT_MASK_EDIT.historyMaxStrokes).toBe(50);
    expect(PHOTO_CUTOUT_MASK_EDIT.historyMaxBytes).toBe(32 * 1024 * 1024);
    expect(PHOTO_CUTOUT_MASK_EDIT.zoomMin).toBe(1);
    expect(PHOTO_CUTOUT_MASK_EDIT.zoomMax).toBe(8);
    expect(PHOTO_CUTOUT_MASK.bboxAlpha).toBeGreaterThan(0);
  });
});
