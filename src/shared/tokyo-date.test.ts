import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  formatHomeDateLabel,
  formatMonthDay,
  isoWeekDates,
  parseCalendarDate,
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
  });
});

describe("format labels", () => {
  it("ホームと日別の見出しを JST 暦日で出す", () => {
    expect(formatHomeDateLabel("2026-09-05")).toBe("9月5日 土曜");
    expect(formatMonthDay("2026-09-05")).toBe("9月5日");
  });
});
