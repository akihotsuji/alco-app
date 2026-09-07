import { describe, expect, it } from "vitest";
import { keyboardInsetPx } from "./keyboard-inset.ts";

describe("keyboardInsetPx", () => {
  it("iOS 型: レイアウトビューポートが縮まずキーボードぶん visualViewport が小さい", () => {
    expect(keyboardInsetPx(844, 500, 0)).toBe(344);
  });

  it("Android 型（resizes-content）: 両方が同じ高さなら 0", () => {
    expect(keyboardInsetPx(500, 500, 0)).toBe(0);
  });

  it("キーボード表示中に上へスクロールした分（offsetTop）は差し引く", () => {
    expect(keyboardInsetPx(844, 500, 344)).toBe(0);
    expect(keyboardInsetPx(844, 500, 100)).toBe(244);
  });

  it("負やサブピクセルの差は 0 に丸めて部品を沈めない", () => {
    expect(keyboardInsetPx(844, 844.4, 0)).toBe(0);
    expect(keyboardInsetPx(844, 900, 0)).toBe(0);
    expect(keyboardInsetPx(844, 843.6, 0)).toBe(0);
  });
});
