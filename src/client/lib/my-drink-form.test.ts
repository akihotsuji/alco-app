import { describe, expect, it } from "vitest";
import {
  applyMyDrinkType,
  INITIAL_MY_DRINK_FORM,
  MY_DRINK_NAME_MESSAGE,
  toMyDrinkBody,
  validateMyDrinkForm,
} from "./my-drink-form.ts";

describe("my-drink-form", () => {
  it("初期値は赤ワイン 125ml / 12%", () => {
    expect(INITIAL_MY_DRINK_FORM).toEqual({
      name: "",
      drinkType: "wine_red",
      volumeMl: 125,
      abvPercent: 12,
    });
  });

  it("種類変更で量と度数をプリセット値に上書きする", () => {
    expect(
      applyMyDrinkType({ ...INITIAL_MY_DRINK_FORM, name: "定番", volumeMl: 750 }, "beer"),
    ).toEqual({
      name: "定番",
      drinkType: "beer",
      volumeMl: 350,
      abvPercent: 5,
    });
    expect(applyMyDrinkType(INITIAL_MY_DRINK_FORM, "other")).toMatchObject({
      drinkType: "other",
      volumeMl: null,
      abvPercent: null,
    });
  });

  it("名前・量・度数の境界を検証する", () => {
    expect(validateMyDrinkForm(INITIAL_MY_DRINK_FORM).name).toBe(MY_DRINK_NAME_MESSAGE);
    expect(
      validateMyDrinkForm({
        ...INITIAL_MY_DRINK_FORM,
        name: "a".repeat(41),
        volumeMl: 0,
        abvPercent: 12.34,
      }),
    ).toMatchObject({
      name: MY_DRINK_NAME_MESSAGE,
      volumeMl: "1以上5000以下で入力してください",
      abvPercent: "小数点以下は1桁までです",
    });
  });

  it("保存値は名前をtrimし、不正値では生成しない", () => {
    expect(toMyDrinkBody({ ...INITIAL_MY_DRINK_FORM, name: "  赤ラベル  " })).toEqual({
      name: "赤ラベル",
      drinkType: "wine_red",
      volumeMl: 125,
      abvPercent: 12,
    });
    expect(toMyDrinkBody(INITIAL_MY_DRINK_FORM)).toBeNull();
  });
});
