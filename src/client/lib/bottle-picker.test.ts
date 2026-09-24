import { describe, expect, it } from "vitest";
import {
  groupPickerBottles,
  pickerBottlesQueryEnabled,
  pickerRowClassName,
} from "./bottle-picker.ts";

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

describe("groupPickerBottles", () => {
  it("味わい中 → セラー → 貯蔵庫の順。別取得の味わい中を先頭に置き、重ねない", () => {
    const opened = [{ id: "o1", status: "opened" }];
    const all = [
      { id: "s1", status: "sealed" },
      { id: "o1", status: "opened" },
      { id: "c1", status: "consumed" },
      { id: "o2", status: "opened" },
      { id: "s2", status: "sealed" },
    ];
    const groups = groupPickerBottles(opened, all);
    expect(groups.map((group) => group.label)).toEqual(["味わい中", "セラー", "貯蔵庫"]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["o1", "o2"],
      ["s1", "s2"],
      ["c1"],
    ]);
  });

  it("空のグループは出さない", () => {
    const groups = groupPickerBottles([], [{ id: "s1", status: "sealed" }]);
    expect(groups.map((group) => group.key)).toEqual(["sealed"]);
    expect(groupPickerBottles([], [])).toEqual([]);
  });
});
