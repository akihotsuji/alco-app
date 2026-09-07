import { describe, expect, it } from "vitest";
import { pickerBottlesQueryEnabled, pickerRowClassName } from "./bottle-picker.ts";

describe("pickerBottlesQueryEnabled", () => {
  it("閉じていれば取らない", () => {
    expect(pickerBottlesQueryEnabled(false, "", false)).toBe(false);
    expect(pickerBottlesQueryEnabled(false, "赤", true)).toBe(false);
  });

  it("記録のピッカーは開いたら検索前でも取る", () => {
    expect(pickerBottlesQueryEnabled(true, "", false)).toBe(true);
  });

  it("ノートのピッカーは検索文字があるときだけ取る", () => {
    expect(pickerBottlesQueryEnabled(true, "", true)).toBe(false);
    expect(pickerBottlesQueryEnabled(true, "  ", true)).toBe(false);
    expect(pickerBottlesQueryEnabled(true, "赤", true)).toBe(true);
  });
});

describe("pickerRowClassName", () => {
  it("選択と貯蔵庫をクラスで表す", () => {
    expect(pickerRowClassName(false, false)).toBe("bottle-picker-row");
    expect(pickerRowClassName(true, false)).toBe("bottle-picker-row is-on");
    expect(pickerRowClassName(false, true)).toBe("bottle-picker-row is-consumed");
    expect(pickerRowClassName(true, true)).toBe("bottle-picker-row is-on is-consumed");
  });
});
