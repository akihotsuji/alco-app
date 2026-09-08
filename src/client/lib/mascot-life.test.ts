import { afterEach, describe, expect, it } from "vitest";
import { MASCOT_LIFE_MS } from "../../shared/constants";
import {
  canStartMascotTap,
  claimMascotLife,
  idleBlinkDelayMs,
  initialMascotLifeState,
  mascotActionDuration,
  releaseMascotLife,
  startMascotTap,
} from "./mascot-life";

afterEach(() => {
  releaseMascotLife("a");
  releaseMascotLife("b");
});

describe("claimMascotLife", () => {
  it("同じ画面では先頭の1体だけ動かす", () => {
    expect(claimMascotLife("a")).toBe(true);
    expect(claimMascotLife("b")).toBe(false);
  });

  it("解放後は次の1体が動ける", () => {
    expect(claimMascotLife("a")).toBe(true);
    releaseMascotLife("a");
    expect(claimMascotLife("b")).toBe(true);
  });
});

describe("mascot tap / idle", () => {
  it("連打ではウィンクを積まない", () => {
    const first = startMascotTap(initialMascotLifeState(), 1_000);
    expect(first?.action).toBe("wink");
    expect(startMascotTap(first ?? initialMascotLifeState(), 1_100)).toBeNull();
    expect(
      canStartMascotTap(first ?? initialMascotLifeState(), 1_000 + MASCOT_LIFE_MS.tapCooldown),
    ).toBe(true);
  });

  it("待機まばたきは 15〜30 秒のあいだ", () => {
    expect(idleBlinkDelayMs(() => 0)).toBe(MASCOT_LIFE_MS.idleBlinkMin);
    expect(idleBlinkDelayMs(() => 1)).toBe(MASCOT_LIFE_MS.idleBlinkMax);
    expect(mascotActionDuration("blink")).toBe(MASCOT_LIFE_MS.blink);
    expect(mascotActionDuration("gaze")).toBe(MASCOT_LIFE_MS.gaze);
    expect(mascotActionDuration("wink")).toBe(MASCOT_LIFE_MS.wink);
    expect(mascotActionDuration("react")).toBe(MASCOT_LIFE_MS.react);
  });
});
