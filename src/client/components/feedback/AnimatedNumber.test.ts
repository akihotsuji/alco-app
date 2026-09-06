import { describe, expect, it } from "vitest";
import { interpolateNumber } from "./AnimatedNumber.tsx";

describe("interpolateNumber", () => {
  it("範囲の始点・中間・終点をease-outで補間する", () => {
    expect(interpolateNumber(0, 10, 0)).toBe(0);
    expect(interpolateNumber(0, 10, 0.5)).toBe(8.75);
    expect(interpolateNumber(0, 10, 1)).toBe(10);
  });

  it("進捗を0〜1に制限し、減少にも使える", () => {
    expect(interpolateNumber(10, 0, -1)).toBe(10);
    expect(interpolateNumber(10, 0, 2)).toBe(0);
  });
});
