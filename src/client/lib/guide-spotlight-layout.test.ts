import { describe, expect, it } from "vitest";
import {
  applyViewportOffset,
  guideTipLayout,
  holeFromRect,
  needsGuideFanReveal,
  pickPreferredGuideTarget,
  shouldMeasureGuideContents,
  unionRects,
  visualViewportOffset,
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

describe("unionRects / viewport offset", () => {
  it("legend が fieldset の上にはみ出したら穴を広げる", () => {
    const union = unionRects([
      { top: 120, left: 20, width: 200, height: 80 },
      { top: 104, left: 20, width: 72, height: 20 },
    ]);
    expect(union).toEqual({ top: 104, left: 20, width: 200, height: 96 });
  });

  it("子が負マージンではみ出したら左右も広げる", () => {
    const union = unionRects([
      { top: 80, left: 24, width: 300, height: 48 },
      { top: 70, left: 16, width: 316, height: 68 },
    ]);
    expect(union).toEqual({ top: 70, left: 16, width: 316, height: 68 });
  });

  it("visualViewport のオフセットを引いて fixed 座標にする", () => {
    const offset = visualViewportOffset({ offsetTop: 40, offsetLeft: 12 });
    expect(offset).toEqual({ top: 40, left: 12 });
    expect(applyViewportOffset({ top: 160, left: 36, width: 100, height: 40 }, offset)).toEqual({
      top: 120,
      left: 24,
      width: 100,
      height: 40,
    });
  });

  it("fieldset と save-bar だけ中身を測る", () => {
    expect(shouldMeasureGuideContents({ tagName: "FIELDSET", className: "log-form-section" })).toBe(
      true,
    );
    expect(shouldMeasureGuideContents({ tagName: "DIV", className: "save-bar" })).toBe(true);
    expect(shouldMeasureGuideContents({ tagName: "BUTTON", className: "home-log-btn" })).toBe(
      false,
    );
  });
});

describe("needsGuideFanReveal", () => {
  it("行が折れていたら扇を出すためにスクロールする", () => {
    expect(needsGuideFanReveal({ top: 900, bottom: 964 }, { top: 56, bottom: 720 })).toBe(true);
  });

  it("扇の高さぶん空いていれば動かさない", () => {
    expect(needsGuideFanReveal({ top: 360, bottom: 424 }, { top: 56, bottom: 720 })).toBe(false);
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
