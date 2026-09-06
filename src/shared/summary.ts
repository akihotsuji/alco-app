import { sumAlcoholGrams } from "./alcohol.ts";
import type { DrinkLogSummaryDay } from "./drink-logs.ts";
import {
  addCalendarDays,
  addCalendarMonths,
  formatMonthDay,
  formatShortMonthDay,
  isoWeekDates,
  isoWeekMonday,
  parseCalendarDate,
} from "./tokyo-date.ts";

export type SummaryViewPeriod = "week" | "month";

export const WEEK_TO_MONTH_LABEL = "今月 ›";
export const MONTH_TO_WEEK_LABEL = "今週";

export function weekSummaryTitle(date: string, today: string): string {
  const week = isoWeekDates(date);
  const from = week[0];
  const to = week[6];
  if (!from || !to) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return week.includes(today) ? "今週" : `${formatMonthDay(from)}〜${formatMonthDay(to)}`;
}

export function monthSummaryTitle(date: string, today: string): string {
  const target = parseCalendarDate(date);
  const current = parseCalendarDate(today);
  if (!target || !current) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  if (target.year === current.year && target.month === current.month) {
    return "今月";
  }
  return `${target.year}年${target.month}月`;
}

export function formatWeekPagerLabel(from: string, to: string): string {
  return `${formatShortMonthDay(from)} 〜 ${formatShortMonthDay(to)}`;
}

export function shiftSummaryDate(period: SummaryViewPeriod, date: string, step: -1 | 1): string {
  if (period === "week") {
    return addCalendarDays(isoWeekMonday(date), step * 7);
  }
  return addCalendarMonths(date, step);
}

/** 次の週・月の開始日が今日より後なら進めない（今日を含む期間が上限）。 */
export function canAdvanceSummary(period: SummaryViewPeriod, date: string, today: string): boolean {
  return shiftSummaryDate(period, date, 1) <= today;
}

export type MonthWeekRow = {
  weekDate: string;
  from: string;
  to: string;
  totalCount: number;
  totalAlcoholG: number;
  dryDayCount: number;
};

/**
 * 月サマリーの日配列を ISO 週で畳む。
 * 月をまたぐ週は月内の日だけ集計し、`weekDate` はその週の月曜（週サマリーは週全体）。
 */
export function foldMonthWeeks(days: readonly DrinkLogSummaryDay[]): MonthWeekRow[] {
  const groups: { monday: string; days: DrinkLogSummaryDay[] }[] = [];
  const indexByMonday = new Map<string, number>();

  for (const day of days) {
    const monday = isoWeekMonday(day.date);
    const existing = indexByMonday.get(monday);
    if (existing === undefined) {
      indexByMonday.set(monday, groups.length);
      groups.push({ monday, days: [day] });
      continue;
    }
    const group = groups[existing];
    if (group) {
      group.days.push(day);
    }
  }

  const rows: MonthWeekRow[] = [];
  for (const group of groups) {
    const first = group.days[0];
    const last = group.days.at(-1);
    if (!first || !last) {
      continue;
    }
    rows.push({
      weekDate: group.monday,
      from: first.date,
      to: last.date,
      totalCount: group.days.reduce((sum, item) => sum + item.count, 0),
      totalAlcoholG: sumAlcoholGrams(group.days.map((item) => item.alcoholG)),
      dryDayCount: group.days.filter((item) => item.isDryDay).length,
    });
  }
  return rows;
}
