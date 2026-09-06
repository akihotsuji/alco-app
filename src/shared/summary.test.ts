import { describe, expect, it } from "vitest";
import type { DrinkLogSummaryDay } from "./drink-logs.ts";
import {
  canAdvanceSummary,
  foldMonthWeeks,
  formatWeekPagerLabel,
  monthSummaryTitle,
  shiftSummaryDate,
  weekSummaryTitle,
} from "./summary.ts";

function day(
  date: string,
  input: Partial<Pick<DrinkLogSummaryDay, "count" | "alcoholG" | "isDryDay" | "isFuture">> = {},
): DrinkLogSummaryDay {
  const count = input.count ?? 0;
  return {
    date,
    count,
    alcoholG: input.alcoholG ?? 0,
    isDryDay: input.isDryDay ?? count === 0,
    isFuture: input.isFuture ?? false,
  };
}

describe("weekSummaryTitle / monthSummaryTitle", () => {
  it("今日を含む週・月は「今週」「今月」、それ以外は範囲・年月", () => {
    expect(weekSummaryTitle("2026-09-05", "2026-09-05")).toBe("今週");
    expect(weekSummaryTitle("2026-08-10", "2026-09-05")).toBe("8月10日〜8月16日");
    expect(monthSummaryTitle("2026-09-20", "2026-09-05")).toBe("今月");
    expect(monthSummaryTitle("2026-08-01", "2026-09-05")).toBe("2026年8月");
  });
});

describe("shiftSummaryDate / canAdvanceSummary", () => {
  it("週は月曜アンカーで7日送り、今日を含む週より先へは進めない", () => {
    expect(shiftSummaryDate("week", "2026-09-05", -1)).toBe("2026-08-24");
    expect(shiftSummaryDate("week", "2026-09-05", 1)).toBe("2026-09-07");
    expect(canAdvanceSummary("week", "2026-08-30", "2026-09-06")).toBe(true);
    expect(canAdvanceSummary("week", "2026-09-06", "2026-09-06")).toBe(false);
  });

  it("月は翌月1日へ送り、今日を含む月より先へは進めない", () => {
    expect(shiftSummaryDate("month", "2026-08-15", 1)).toBe("2026-09-01");
    expect(shiftSummaryDate("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(canAdvanceSummary("month", "2026-08-15", "2026-09-06")).toBe(true);
    expect(canAdvanceSummary("month", "2026-09-06", "2026-09-06")).toBe(false);
  });
});

describe("formatWeekPagerLabel", () => {
  it("先頭ゼロなしの月日で週範囲を出す", () => {
    expect(formatWeekPagerLabel("2026-08-31", "2026-09-06")).toBe("8/31 〜 9/6");
  });
});

describe("foldMonthWeeks", () => {
  it("月をまたぐ週は月内の日だけ畳み、weekDate は週全体の月曜にする", () => {
    const days = [
      day("2026-09-01", { count: 1, alcoholG: 10 }),
      day("2026-09-02"),
      day("2026-09-03"),
      day("2026-09-04"),
      day("2026-09-05", { count: 2, alcoholG: 12.34 }),
      day("2026-09-06"),
      day("2026-09-07", { isFuture: true, isDryDay: false }),
    ];
    const rows = foldMonthWeeks(days);
    expect(rows).toEqual([
      {
        weekDate: "2026-08-31",
        from: "2026-09-01",
        to: "2026-09-06",
        totalCount: 3,
        totalAlcoholG: 22.34,
        dryDayCount: 4,
      },
      {
        weekDate: "2026-09-07",
        from: "2026-09-07",
        to: "2026-09-07",
        totalCount: 0,
        totalAlcoholG: 0,
        dryDayCount: 0,
      },
    ]);
  });
});
