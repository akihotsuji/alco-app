import { describe, expect, it } from "vitest";
import {
  historyHasFlag,
  historyIdx,
  isPhotoHandoff,
  PHOTO_HANDOFF_FLAG,
  photoHandoffState,
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
