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
  const probe = utcDateFromParts({ year, month, day });
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function requireCalendarDate(value: string): CalendarDate {
  const parsed = parseCalendarDate(value);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${value}`);
  }
  return parsed;
}

function utcDateFromParts(parts: CalendarDate): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function formatCalendarDate(parts: CalendarDate): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** 暦日としての加減。タイムゾーンを持たない YYYY-MM-DD 同士の計算に使う。 */
export function addCalendarDays(value: string, days: number): string {
  const parsed = requireCalendarDate(value);
  const shifted = utcDateFromParts({
    year: parsed.year,
    month: parsed.month,
    day: parsed.day + days,
  });
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
  const weekday = utcDateFromParts(requireCalendarDate(date)).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = addCalendarDays(date, -daysFromMonday);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addCalendarDays(monday, offset));
}

/** ISO 週の月曜（JST 暦日）。 */
export function isoWeekMonday(date: string): string {
  const monday = isoWeekDates(date)[0];
  if (!monday) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return monday;
}

/** 暦月としての加減。結果は常に 1 日（月送りのアンカー用）。 */
export function addCalendarMonths(date: string, months: number): string {
  const parsed = requireCalendarDate(date);
  const shifted = utcDateFromParts({
    year: parsed.year,
    month: parsed.month + months,
    day: 1,
  });
  return formatCalendarDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: 1,
  });
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

function weekdayIndex(date: string): number {
  return utcDateFromParts(requireCalendarDate(date)).getUTCDay();
}

/** 例: 9月5日 */
export function formatMonthDay(date: string): string {
  const parsed = requireCalendarDate(date);
  return `${parsed.month}月${parsed.day}日`;
}

/** 例: 9月5日 土曜 */
export function formatHomeDateLabel(date: string): string {
  return `${formatMonthDay(date)} ${WEEKDAY_JA[weekdayIndex(date)]}曜`;
}

/** 例: 9/5 */
export function formatShortMonthDay(date: string): string {
  const parsed = requireCalendarDate(date);
  return `${parsed.month}/${parsed.day}`;
}

/** 例: 土 */
export function formatWeekdayShort(date: string): string {
  const label = WEEKDAY_JA[weekdayIndex(date)];
  if (!label) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return label;
}

/** 例: 2026年8月 */
export function formatYearMonth(date: string): string {
  const parsed = requireCalendarDate(date);
  return `${parsed.year}年${parsed.month}月`;
}

export const WEEKDAY_LABELS_MON_SUN = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** Asia/Tokyo は DST が無く常に +09:00。 */
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;

const LOCAL_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const tokyoTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TOKYO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * `datetime-local` の値（`YYYY-MM-DDTHH:MM`）を **常に Asia/Tokyo として**解釈し UTC ISO にする。
 * 端末のタイムゾーンには依存しない（spec/features/drink-log.md 3.7）。不正なら null。
 */
export function tokyoLocalToIso(local: string): string | null {
  const matched = LOCAL_DATETIME_RE.exec(local);
  if (!matched?.[1] || !matched[2] || !matched[3]) {
    return null;
  }
  const date = parseCalendarDate(matched[1]);
  const hour = Number(matched[2]);
  const minute = Number(matched[3]);
  if (!date || hour > 23 || minute > 59) {
    return null;
  }
  const utcMs = Date.UTC(date.year, date.month - 1, date.day, hour, minute) - TOKYO_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** 瞬間を Asia/Tokyo の `HH:MM`（24 時間）にする。 */
export function formatTokyoTime(instant: Date): string {
  return tokyoTimeFormatter.format(instant);
}

/** 瞬間を `datetime-local` 用の `YYYY-MM-DDTHH:MM`（Asia/Tokyo）にする。 */
export function instantToTokyoLocal(instant: Date): string {
  return `${tokyoToday(instant)}T${formatTokyoTime(instant)}`;
}

/** 過去日の既定時刻 20:00 JST（`<date>T11:00:00.000Z`）。 */
export function tokyoEveningIso(date: string): string {
  const iso = tokyoLocalToIso(`${date}T20:00`);
  if (!iso) {
    throw new Error(`invalid calendar date: ${date}`);
  }
  return iso;
}
