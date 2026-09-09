import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./use-focus-trap.ts";

describe("nextFocusIndex", () => {
  it("末尾の次は先頭、先頭の Shift+Tab は末尾", () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(2, 3, false)).toBe(0);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(1, 3, true)).toBe(0);
  });

  it("要素が無い・1 つのときは循環しない添字規則", () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
    expect(nextFocusIndex(0, 1, false)).toBe(0);
    expect(nextFocusIndex(0, 1, true)).toBe(0);
  });
});
