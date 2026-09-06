import { describe, expect, it } from "vitest";
import {
  ABV_PERCENT_MAX,
  ABV_PERCENT_MIN,
  BOTTLE_VOLUME_CHIPS,
  calculateAlcoholGrams,
  DRINK_TYPE_PRESETS,
  displayAlcoholGrams,
  ETHANOL_DENSITY,
  isDryDay,
  sumAlcoholGrams,
  VOLUME_ML_MAX,
  VOLUME_ML_MIN,
  volumeChipsFor,
} from "./alcohol.ts";
import { DRINK_TYPES } from "./constants.ts";

describe("calculateAlcoholGrams", () => {
  it("種類デフォルトの保存丸めが spec 8.1 と一致する", () => {
    expect(calculateAlcoholGrams(125, 12)).toBe(12);
    expect(calculateAlcoholGrams(350, 5)).toBe(14);
    expect(calculateAlcoholGrams(30, 40)).toBe(9.6);
    expect(calculateAlcoholGrams(180, 15)).toBe(21.6);
    expect(calculateAlcoholGrams(60, 25)).toBe(12);
    expect(calculateAlcoholGrams(120, 15)).toBe(14.4);
  });

  it("丸め例題の保存値が spec 8.2 と一致する", () => {
    expect(calculateAlcoholGrams(333, 5)).toBe(13.32);
    expect(calculateAlcoholGrams(123, 7)).toBe(6.89);
    expect(calculateAlcoholGrams(100, 13)).toBe(10.4);
    expect(calculateAlcoholGrams(1, 0.1)).toBe(0);
    expect(calculateAlcoholGrams(350, 0)).toBe(0);
    expect(calculateAlcoholGrams(750, 12)).toBe(72);
    expect(calculateAlcoholGrams(5000, 100)).toBe(4000);
  });

  it("下限・上限・小数の境界を保存丸め後で厳密比較する", () => {
    expect(calculateAlcoholGrams(1, 0.1)).toBe(0);
    expect(calculateAlcoholGrams(5000, 100)).toBe(4000);
    expect(calculateAlcoholGrams(123, 7)).toBe(6.89);
  });

  it("不正入力でも throw しない（検証は呼び元 Zod）", () => {
    expect(() => calculateAlcoholGrams(Number.NaN, 12)).not.toThrow();
    expect(() => calculateAlcoholGrams(125, Number.POSITIVE_INFINITY)).not.toThrow();
    expect(Number.isNaN(calculateAlcoholGrams(Number.NaN, 12))).toBe(true);
  });
});

describe("displayAlcoholGrams", () => {
  it("保存値を小数第 1 位にする", () => {
    expect(displayAlcoholGrams(12)).toBe(12);
    expect(displayAlcoholGrams(9.6)).toBe(9.6);
    expect(displayAlcoholGrams(13.32)).toBe(13.3);
    expect(displayAlcoholGrams(6.89)).toBe(6.9);
    expect(displayAlcoholGrams(10.4)).toBe(10.4);
    expect(displayAlcoholGrams(0)).toBe(0);
    expect(displayAlcoholGrams(72)).toBe(72);
    expect(displayAlcoholGrams(4000)).toBe(4000);
  });
});

describe("sumAlcoholGrams", () => {
  it("保存値を合算してから第 2 位に揃え、表示は別関数", () => {
    expect(sumAlcoholGrams([9.64, 9.64])).toBe(19.28);
    expect(displayAlcoholGrams(19.28)).toBe(19.3);
    expect(sumAlcoholGrams([])).toBe(0);
  });
});

describe("isDryDay", () => {
  it("記録 0 件だけ休肝。0g の行や未来日は休肝にしない", () => {
    expect(isDryDay(0)).toBe(true);
    expect(isDryDay(1)).toBe(false);
    expect(isDryDay(1, false)).toBe(false);
    expect(isDryDay(0, true)).toBe(false);
  });
});

describe("DRINK_TYPE_PRESETS", () => {
  it("7 種類すべてのキーがあり、密度と入力範囲の定数が spec と一致する", () => {
    expect(ETHANOL_DENSITY).toBe(0.8);
    expect(VOLUME_ML_MIN).toBe(1);
    expect(VOLUME_ML_MAX).toBe(5000);
    expect(ABV_PERCENT_MIN).toBe(0);
    expect(ABV_PERCENT_MAX).toBe(100);
    expect(Object.keys(DRINK_TYPE_PRESETS)).toEqual([...DRINK_TYPES]);
  });

  it("種類デフォルトから計算した保存値が 8.1 と一致する", () => {
    const expected = {
      wine: 12,
      beer: 14,
      whisky: 9.6,
      sake: 21.6,
      shochu: 12,
      cocktail: 14.4,
    } as const;

    for (const [type, grams] of Object.entries(expected)) {
      const preset = DRINK_TYPE_PRESETS[type as keyof typeof expected];
      expect(calculateAlcoholGrams(preset.volumeMl, preset.abvPercent)).toBe(grams);
    }
    expect(DRINK_TYPE_PRESETS.other.volumeMl).toBeNull();
    expect(DRINK_TYPE_PRESETS.other.abvPercent).toBeNull();
  });

  it("量チップは種類の値にボトル量を足す", () => {
    expect(BOTTLE_VOLUME_CHIPS).toEqual([375, 750, 1500]);
    expect(volumeChipsFor("wine")).toEqual([125, 150, 375, 750, 1500]);
    expect(volumeChipsFor("other")).toEqual([375, 750, 1500]);
  });
});
