import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  addCalendarMonths,
  formatHomeDateLabel,
  formatMonthDay,
  formatShortMonthDay,
  formatTokyoTime,
  formatWeekdayShort,
  formatYearMonth,
  instantToTokyoLocal,
  isoWeekDates,
  isoWeekMonday,
  parseCalendarDate,
  tokyoEveningIso,
  tokyoLocalToIso,
  tokyoToday,
} from "./tokyo-date.ts";

describe("parseCalendarDate", () => {
  it("YYYY-MM-DD だけ通し、実在しない日は拒否する", () => {
    expect(parseCalendarDate("2026-09-05")).toEqual({ year: 2026, month: 9, day: 5 });
    expect(parseCalendarDate("2026-02-29")).toBeNull();
    expect(parseCalendarDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseCalendarDate("2026-13-01")).toBeNull();
    expect(parseCalendarDate("2026-9-5")).toBeNull();
    expect(parseCalendarDate("new")).toBeNull();
  });
});

describe("addCalendarDays", () => {
  it("月をまたいで加減する", () => {
    expect(addCalendarDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addCalendarDays("2026-09-30", 1)).toBe("2026-10-01");
  });
});

describe("tokyoToday", () => {
  it("UTC 前日でも JST 当日になる", () => {
    expect(tokyoToday(new Date("2026-09-04T15:00:00.000Z"))).toBe("2026-09-05");
    expect(tokyoToday(new Date("2026-09-04T14:59:59.000Z"))).toBe("2026-09-04");
  });
});

describe("isoWeekDates", () => {
  it("月曜始まりの ISO 週を返す", () => {
    expect(isoWeekDates("2026-09-05")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
    expect(isoWeekDates("2026-09-07")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    expect(isoWeekMonday("2026-09-05")).toBe("2026-08-31");
  });
});

describe("addCalendarMonths", () => {
  it("常に翌月・前月の1日を返す", () => {
    expect(addCalendarMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addCalendarMonths("2026-08-15", 1)).toBe("2026-09-01");
  });
});

describe("format labels", () => {
  it("ホームと日別の見出しを JST 暦日で出す", () => {
    expect(formatHomeDateLabel("2026-09-05")).toBe("9月5日 土曜");
    expect(formatMonthDay("2026-09-05")).toBe("9月5日");
    expect(formatShortMonthDay("2026-09-05")).toBe("9/5");
    expect(formatWeekdayShort("2026-09-05")).toBe("土");
    expect(formatYearMonth("2026-08-01")).toBe("2026年8月");
  });

  it("不正な暦日は投げる", () => {
    expect(() => isoWeekDates("new")).toThrow("invalid calendar date: new");
    expect(() => formatMonthDay("2026-09-31")).toThrow("invalid calendar date: 2026-09-31");
    expect(() => addCalendarDays("2026-13-01", 1)).toThrow("invalid calendar date: 2026-13-01");
  });
});

describe("datetime-local と JST", () => {
  it("datetime-local の値を常に Asia/Tokyo として UTC ISO にする", () => {
    expect(tokyoLocalToIso("2026-09-04T20:00")).toBe("2026-09-04T11:00:00.000Z");
    expect(tokyoLocalToIso("2026-09-05T00:00")).toBe("2026-09-04T15:00:00.000Z");
    expect(tokyoLocalToIso("2026-09-04T23:59")).toBe("2026-09-04T14:59:00.000Z");
    expect(tokyoLocalToIso("2026-09-04T20:00:30")).toBe("2026-09-04T11:00:00.000Z");
  });

  it("不正な datetime-local は null", () => {
    expect(tokyoLocalToIso("2026-02-30T20:00")).toBeNull();
    expect(tokyoLocalToIso("2026-09-04T24:00")).toBeNull();
    expect(tokyoLocalToIso("2026-09-04T20:60")).toBeNull();
    expect(tokyoLocalToIso("2026-09-04 20:00")).toBeNull();
    expect(tokyoLocalToIso("")).toBeNull();
  });

  it("瞬間を JST の HH:MM / datetime-local に戻す（往復）", () => {
    const instant = new Date("2026-09-04T14:59:00.000Z");
    expect(formatTokyoTime(instant)).toBe("23:59");
    expect(instantToTokyoLocal(instant)).toBe("2026-09-04T23:59");
    expect(instantToTokyoLocal(new Date("2026-09-04T15:00:00.000Z"))).toBe("2026-09-05T00:00");
    expect(tokyoLocalToIso(instantToTokyoLocal(instant))).toBe(instant.toISOString());
  });

  it("過去日の既定時刻は 20:00 JST", () => {
    expect(tokyoEveningIso("2026-09-04")).toBe("2026-09-04T11:00:00.000Z");
    expect(() => tokyoEveningIso("2026-13-01")).toThrow("invalid calendar date: 2026-13-01");
  });
});
