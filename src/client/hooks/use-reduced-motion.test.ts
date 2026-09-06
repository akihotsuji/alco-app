import { describe, expect, it } from "vitest";
import { parseReduceMotionPref } from "@/client/lib/preferences.ts";
import { resolveReduceMotion } from "./use-reduced-motion.ts";

describe("resolveReduceMotion", () => {
  it("OS の reduce または設定 always のどちらかで true", () => {
    expect(resolveReduceMotion(false, "system")).toBe(false);
    expect(resolveReduceMotion(true, "system")).toBe(true);
    expect(resolveReduceMotion(false, "always")).toBe(true);
    expect(resolveReduceMotion(true, "always")).toBe(true);
  });

  it("保存値が壊れていたら system 扱い", () => {
    expect(parseReduceMotionPref(null)).toBe("system");
    expect(parseReduceMotionPref("always")).toBe("always");
    expect(parseReduceMotionPref("system")).toBe("system");
    expect(parseReduceMotionPref("yes")).toBe("system");
  });
});
