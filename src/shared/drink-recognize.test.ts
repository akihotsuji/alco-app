import { describe, expect, it } from "vitest";
import { pickDrinkRecognizeFields } from "./drink-recognize.ts";

describe("pickDrinkRecognizeFields", () => {
  it("壊れた JSON / 非オブジェクトは空 fields", () => {
    expect(pickDrinkRecognizeFields(null)).toEqual({});
    expect(pickDrinkRecognizeFields("not-json")).toEqual({});
    expect(pickDrinkRecognizeFields(12)).toEqual({});
  });

  it("範囲外・未知 enum は省き、正常な欄だけ残す。量は整数に丸める", () => {
    const fields = pickDrinkRecognizeFields({
      drinkType: { value: "beer", confidence: 0.8 },
      volumeMl: { value: 349.6, confidence: 0.7 },
      abvPercent: { value: 5.04, confidence: 0.6 },
      extra: { value: "no", confidence: 1 },
    });
    expect(fields).toEqual({
      drinkType: { value: "beer", confidence: 0.8 },
      volumeMl: { value: 350, confidence: 0.7 },
      abvPercent: { value: 5, confidence: 0.6 },
    });
  });

  it("未知の種類・量の範囲外は捨てる", () => {
    expect(
      pickDrinkRecognizeFields({
        drinkType: { value: "vodka", confidence: 0.9 },
        volumeMl: { value: 9000, confidence: 0.9 },
        abvPercent: { value: 120, confidence: 0.9 },
      }),
    ).toEqual({});
  });
});
