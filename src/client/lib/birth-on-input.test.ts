import { describe, expect, it } from "vitest";
import {
  birthOnPartsLookComplete,
  composeBirthOn,
  sanitizeBirthOnPart,
  shouldAdvanceBirthOnPart,
} from "./birth-on-input.ts";

const TODAY = "2026-09-10";

describe("sanitizeBirthOnPart", () => {
  it("全角数字を半角にし、数字以外を捨て、桁数で切る", () => {
    expect(sanitizeBirthOnPart("year", "１９９０")).toBe("1990");
    expect(sanitizeBirthOnPart("year", "19a9b05")).toBe("1990");
    expect(sanitizeBirthOnPart("month", "123")).toBe("12");
    expect(sanitizeBirthOnPart("day", "-")).toBe("");
  });
});

describe("shouldAdvanceBirthOnPart", () => {
  it("年は 4 桁で進む", () => {
    expect(shouldAdvanceBirthOnPart("year", "199")).toBe(false);
    expect(shouldAdvanceBirthOnPart("year", "1990")).toBe(true);
  });
  it("月は 2 桁、または 1 桁でも 2〜9 なら進む（1 は 10〜12 の可能性を残す）", () => {
    expect(shouldAdvanceBirthOnPart("month", "1")).toBe(false);
    expect(shouldAdvanceBirthOnPart("month", "0")).toBe(false);
    expect(shouldAdvanceBirthOnPart("month", "2")).toBe(true);
    expect(shouldAdvanceBirthOnPart("month", "12")).toBe(true);
  });
  it("日は 2 桁、または 1 桁でも 4〜9 なら進む（1〜3 は 10〜31 の可能性を残す）", () => {
    expect(shouldAdvanceBirthOnPart("day", "3")).toBe(false);
    expect(shouldAdvanceBirthOnPart("day", "4")).toBe(true);
    expect(shouldAdvanceBirthOnPart("day", "15")).toBe(true);
  });
});

describe("composeBirthOn", () => {
  it("1 桁の月日は 0 埋めして YYYY-MM-DD にする", () => {
    expect(composeBirthOn({ year: "1990", month: "1", day: "5" }, TODAY)).toBe("1990-01-05");
    expect(composeBirthOn({ year: "2006", month: "09", day: "10" }, TODAY)).toBe("2006-09-10");
  });
  it("欠けがあれば null", () => {
    expect(composeBirthOn({ year: "199", month: "1", day: "5" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "1990", month: "", day: "5" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "1990", month: "1", day: "" }, TODAY)).toBeNull();
  });
  it("実在しない日・1900 年より前・未来日は null", () => {
    expect(composeBirthOn({ year: "2001", month: "2", day: "30" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "1990", month: "13", day: "1" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "1899", month: "12", day: "31" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "2026", month: "9", day: "11" }, TODAY)).toBeNull();
    expect(composeBirthOn({ year: "2026", month: "9", day: "10" }, TODAY)).toBe("2026-09-10");
  });
  it("閏日を受け付ける", () => {
    expect(composeBirthOn({ year: "2004", month: "2", day: "29" }, TODAY)).toBe("2004-02-29");
  });
});

describe("birthOnPartsLookComplete", () => {
  it("年 4 桁 + 月日に何か入っていれば完了扱い", () => {
    expect(birthOnPartsLookComplete({ year: "1990", month: "1", day: "5" })).toBe(true);
    expect(birthOnPartsLookComplete({ year: "1990", month: "1", day: "" })).toBe(false);
    expect(birthOnPartsLookComplete({ year: "199", month: "1", day: "5" })).toBe(false);
  });
});
