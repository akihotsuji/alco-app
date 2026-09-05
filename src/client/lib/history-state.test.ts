import { describe, expect, it } from "vitest";
import { historyHasFlag, historyIdx } from "./history-state.ts";

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
