import type { DrinkLogSummaryDay } from "@/shared/drink-logs.ts";
import { parseCalendarDate, WEEKDAY_LABELS_MON_SUN } from "@/shared/tokyo-date.ts";

/** ホーム今日カードの表示状態。記録 0 件は未記録であり、自動では休肝日にしない */
export type HomeTodayStatus = "unrecorded" | "logged";

export function homeTodayStatus(totalCount: number): HomeTodayStatus {
  return totalCount > 0 ? "logged" : "unrecorded";
}

export function homeTodayStatusLabel(status: HomeTodayStatus): string {
  return status === "logged" ? "記録あり" : "未記録";
}

export function homeTodayFootnote(status: HomeTodayStatus, totalCount: number): string {
  if (status === "unrecorded") {
    return "今日はまだ記録がありません";
  }
  return `今日は ${totalCount} 杯記録しています`;
}

export function homeMascotPose(
  status: HomeTodayStatus,
  cheering: boolean,
): "cheer" | "default" | "rest" {
  if (cheering) {
    return "cheer";
  }
  return status === "logged" ? "default" : "rest";
}

export type HomeWeekDayView = {
  date: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
  hasRecord: boolean;
  filling: boolean;
  href: string;
  label: string;
};

export function homeWeekDayView(
  item: DrinkLogSummaryDay,
  index: number,
  today: string,
  todayFilling: boolean,
): HomeWeekDayView {
  const parsed = parseCalendarDate(item.date);
  if (!parsed) {
    throw new Error(`invalid calendar date: ${item.date}`);
  }
  const weekday = WEEKDAY_LABELS_MON_SUN[index] ?? "";
  const isToday = item.date === today;
  const hasRecord = item.count > 0;
  const statusText = item.isFuture ? "未来" : hasRecord ? `${item.count}杯` : "記録なし";
  const labelParts = [`${weekday}曜日`, `${parsed.day}日`];
  if (isToday) {
    labelParts.push("今日");
  }
  labelParts.push(statusText);
  return {
    date: item.date,
    weekday,
    dayNumber: parsed.day,
    isToday,
    isFuture: item.isFuture,
    hasRecord,
    filling: isToday && todayFilling,
    href: `/logs/${item.date}`,
    label: labelParts.join(" "),
  };
}
