import { describe, expect, it } from "vitest";
import {
  bottleConsumeState,
  bottlePlacedState,
  consumeLeftEvent,
  consumeUndoRequested,
  historyHasFlag,
  historyIdx,
  isPhotoHandoff,
  PHOTO_HANDOFF_FLAG,
  photoHandoffState,
  placedBottleEvent,
  rememberShelfEvent,
  takeRememberedShelfEvent,
  withHistoryFlag,
} from "./history-state.ts";

describe("historyIdx", () => {
  it("数値の idx だけ返す", () => {
    expect(historyIdx({ idx: 3 })).toBe(3);
    expect(historyIdx({ idx: 0 })).toBe(0);
    expect(historyIdx({ idx: "1" })).toBeUndefined();
    expect(historyIdx(null)).toBeUndefined();
    expect(historyIdx("idx")).toBeUndefined();
  });
});

describe("historyHasFlag", () => {
  it("真の真偽値だけをフラグとみなす", () => {
    expect(historyHasFlag({ alcoPhotoEdit: true }, "alcoPhotoEdit")).toBe(true);
    expect(historyHasFlag({ alcoPhotoEdit: false }, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag({ alcoPhotoEdit: "true" }, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag({}, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag(null, "alcoPhotoEdit")).toBe(false);
  });
});

describe("withHistoryFlag", () => {
  it("router の idx を 1 進めて引き継ぎ、フラグを立てる", () => {
    expect(withHistoryFlag({ idx: 2, usr: null, key: "k" }, "alcoPhotoEdit")).toEqual({
      idx: 3,
      usr: null,
      key: "k",
      alcoPhotoEdit: true,
    });
  });

  it("idx が無ければ付けず、state が無くてもフラグだけ立てる", () => {
    expect(withHistoryFlag(null, "alcoPhotoEdit")).toEqual({ alcoPhotoEdit: true });
    expect(withHistoryFlag({ usr: 1 }, "alcoPhotoEdit")).toEqual({ usr: 1, alcoPhotoEdit: true });
    expect(withHistoryFlag({ idx: "1" }, "alcoPhotoEdit")).toEqual({
      idx: "1",
      alcoPhotoEdit: true,
    });
  });
});

describe("photoHandoffState / isPhotoHandoff", () => {
  it("撮影 → 使う で開いた log-new だけ真", () => {
    expect(isPhotoHandoff(photoHandoffState())).toBe(true);
    expect(isPhotoHandoff({ [PHOTO_HANDOFF_FLAG]: "1" })).toBe(false);
    expect(isPhotoHandoff(null)).toBe(false);
    expect(isPhotoHandoff(undefined)).toBe(false);
  });
});

describe("bottle consume / placed state", () => {
  const left = {
    bottleId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-06T00:00:00.000Z",
  };

  it("開栓の left と undo フラグを読む", () => {
    const state = bottleConsumeState(left);
    expect(consumeLeftEvent(state)).toEqual(left);
    expect(consumeUndoRequested(state)).toBe(true);
    expect(consumeLeftEvent({ left: { bottleId: left.bottleId } })).toBeNull();
    expect(consumeUndoRequested({ consumeUndo: "1" })).toBe(false);
  });

  it("復元の placed を読む", () => {
    expect(placedBottleEvent(bottlePlacedState(left))).toEqual(left);
    expect(placedBottleEvent({ placed: "x" })).toBeNull();
  });

  it("sessionStorage の棚演出は 1 回だけ取る", () => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return memory.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          memory.set(key, value);
        },
        removeItem(key: string) {
          memory.delete(key);
        },
      },
    });
    rememberShelfEvent({ kind: "placed", ...left });
    expect(takeRememberedShelfEvent()).toEqual({ kind: "placed", ...left });
    expect(takeRememberedShelfEvent()).toBeNull();
  });
});
