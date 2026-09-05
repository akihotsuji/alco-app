/** 日付境界の正。保存は UTC、表示・日次集計は Asia/Tokyo（spec/00-overview.md）。 */
export const TOKYO_TIME_ZONE = "Asia/Tokyo";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const tokyoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function parseCalendarDate(value: string): CalendarDate | null {
  const matched = DATE_RE.exec(value);
  if (!matched) {
    return null;
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatCalendarDate(parts: CalendarDate): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** 暦日としての加減。タイムゾーンを持たない YYYY-MM-DD 同士の計算に使う。 */
export function addCalendarDays(value: string, days: number): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${value}`);
  }
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatCalendarDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** `now` の Asia/Tokyo カレンダー日（YYYY-MM-DD）。 */
export function tokyoToday(now: Date = new Date()): string {
  return tokyoDateFormatter.format(now);
}

export function isTokyoToday(value: string, now: Date = new Date()): boolean {
  return value === tokyoToday(now);
}

/** ISO 週（月曜始まり）の 7 日。`date` はその週に含まれる YYYY-MM-DD。 */
export function isoWeekDates(date: string): string[] {
  const parsed = parseCalendarDate(date);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = addCalendarDays(date, -daysFromMonday);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addCalendarDays(monday, offset));
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

function weekdayIndex(date: string): number {
  const parsed = parseCalendarDate(date);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

/** 例: 9月5日 */
export function formatMonthDay(date: string): string {
  const parsed = parseCalendarDate(date);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return `${parsed.month}月${parsed.day}日`;
}

/** 例: 9月5日 土曜 */
export function formatHomeDateLabel(date: string): string {
  return `${formatMonthDay(date)} ${WEEKDAY_JA[weekdayIndex(date)]}曜`;
}

export const WEEKDAY_LABELS_MON_SUN = ["月", "火", "水", "木", "金", "土", "日"] as const;
