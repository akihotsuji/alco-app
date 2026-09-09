import { describe, expect, it } from "vitest";
import { shouldReloadOnControllerChange } from "./sw-update.ts";

describe("shouldReloadOnControllerChange", () => {
  it("初回制御開始では再読み込みしない", () => {
    expect(shouldReloadOnControllerChange(false)).toBe(false);
    expect(shouldReloadOnControllerChange(true)).toBe(true);
  });
});
