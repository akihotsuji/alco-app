import { describe, expect, it } from "vitest";
import {
  guideTipLayout,
  holeFromRect,
  pickPreferredGuideTarget,
} from "./guide-spotlight-layout.ts";

describe("pickPreferredGuideTarget", () => {
  it("空状態の主ボタンを FAB より優先する", () => {
    const picked = pickPreferredGuideTarget([
      { className: "add-fab", width: 52, height: 52 },
      { className: "empty-action", width: 200, height: 48 },
    ]);
    expect(picked?.className).toBe("empty-action");
  });

  it("見えない候補は捨てる", () => {
    expect(
      pickPreferredGuideTarget([
        { className: "empty-action", width: 0, height: 0 },
        { className: "add-fab", width: 52, height: 52 },
      ])?.className,
    ).toBe("add-fab");
  });
});

describe("guideTipLayout", () => {
  it("下に余裕があれば下へ置き、矢印を対象の中央へ寄せる", () => {
    const hole = holeFromRect({ top: 80, left: 24, width: 200, height: 48 });
    const tip = guideTipLayout(hole, { width: 390, height: 844 }, { width: 320, height: 120 });
    expect(tip.placement).toBe("below");
    expect(tip.top).toBe(hole.top + hole.height + 12);
    expect(tip.left + tip.arrowLeft).toBeCloseTo(hole.left + hole.width / 2, 5);
  });

  it("下に足りなければ上へ置く", () => {
    const hole = holeFromRect({ top: 720, left: 300, width: 52, height: 52 });
    const tip = guideTipLayout(hole, { width: 390, height: 844 }, { width: 320, height: 128 });
    expect(tip.placement).toBe("above");
    expect(tip.left + tip.width).toBeLessThanOrEqual(390 - 16);
  });
});
