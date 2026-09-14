import { describe, expect, it } from "vitest";
import { BOTTLE_COUNT_MAX, BOTTLE_COUNT_MIN } from "@/shared/bottles.ts";
import { clampCountInput } from "./CountStepper.tsx";

describe("clampCountInput", () => {
  it("整数だけ受け、1〜12 に収める", () => {
    expect(clampCountInput("3", 1)).toBe(3);
    expect(clampCountInput("0", 2)).toBe(BOTTLE_COUNT_MIN);
    expect(clampCountInput("13", 2)).toBe(BOTTLE_COUNT_MAX);
    expect(clampCountInput("1.5", 4)).toBe(4);
    expect(clampCountInput("abc", 5)).toBe(5);
  });
});
