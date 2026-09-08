import { describe, expect, it } from "vitest";
import {
  blendRgbaOverHex,
  contrastMeetsBody,
  contrastRatio,
  hexContrastRatio,
  parseHexColor,
  WCAG_BODY_MIN,
} from "./contrast.ts";

describe("contrast 計算", () => {
  it("黒と白は 21:1、同じ色は 1:1", () => {
    expect(hexContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(hexContrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("不正な HEX は投げ、半透明の重ねは下地を明るくする", () => {
    expect(() => parseHexColor("#gg0000")).toThrow("invalid hex color");
    const blended = blendRgbaOverHex({ r: 255, g: 255, b: 255, a: 0.14 }, "#7a3538");
    expect(blended[0]).toBeGreaterThan(0x7a);
    expect(contrastMeetsBody(WCAG_BODY_MIN)).toBe(true);
    expect(contrastMeetsBody(4.49)).toBe(false);
    expect(contrastRatio(parseHexColor("#000000"), parseHexColor("#ffffff"))).toBeGreaterThan(20);
  });
});
