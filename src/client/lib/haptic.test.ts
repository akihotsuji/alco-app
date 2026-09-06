import { describe, expect, it, vi } from "vitest";
import { createHaptic, HAPTIC_MAX_TOTAL_MS, HAPTIC_PATTERNS, isHapticSupported } from "./haptic.ts";

describe("haptic", () => {
  it("パターンは light 10ms / success 10-40-10ms で、合計 100ms 以内", () => {
    expect(HAPTIC_PATTERNS.light).toEqual([10]);
    expect(HAPTIC_PATTERNS.success).toEqual([10, 40, 10]);
    for (const pattern of Object.values(HAPTIC_PATTERNS)) {
      expect(pattern.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(HAPTIC_MAX_TOTAL_MS);
    }
    expect("error" in HAPTIC_PATTERNS).toBe(false);
  });

  it("設定 OFF（既定）では vibrate を呼ばない", () => {
    const vibrate = vi.fn(() => true);
    const haptic = createHaptic({ isEnabled: () => false, getVibrate: () => vibrate });
    expect(haptic("success")).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("設定 ON かつ対応端末なら該当パターンで 1 回呼ぶ", () => {
    const vibrate = vi.fn(() => true);
    const haptic = createHaptic({ isEnabled: () => true, getVibrate: () => vibrate });
    expect(haptic("light")).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([10]);
    haptic("success");
    expect(vibrate).toHaveBeenLastCalledWith([10, 40, 10]);
  });

  it("未対応端末（vibrate 無し）では no-op", () => {
    const haptic = createHaptic({ isEnabled: () => true, getVibrate: () => undefined });
    expect(haptic("success")).toBe(false);
  });

  it("vibrate が無い環境では未対応", () => {
    const original = navigator.vibrate;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    expect(isHapticSupported()).toBe(false);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: original });
  });

  it("vibrate が投げても握って false", () => {
    const haptic = createHaptic({
      isEnabled: () => true,
      getVibrate: () => () => {
        throw new Error("blocked");
      },
    });
    expect(haptic("light")).toBe(false);
  });
});
