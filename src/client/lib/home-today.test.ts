import { describe, expect, it } from "vitest";
import type { DrinkLogSummaryDay } from "@/shared/drink-logs.ts";
import {
  homeMascotPose,
  homeTodayFootnote,
  homeTodayStatus,
  homeTodayStatusLabel,
  homeWeekDayView,
} from "./home-today.ts";

function day(
  input: Partial<DrinkLogSummaryDay> & Pick<DrinkLogSummaryDay, "date">,
): DrinkLogSummaryDay {
  return {
    count: 0,
    alcoholG: 0,
    isDryDay: false,
    isFuture: false,
    ...input,
  };
}

describe("homeTodayStatus", () => {
  it("記録 0 件は未記録であり、杯数 0 だけでは休肝日にしない", () => {
    expect(homeTodayStatus(0)).toBe("unrecorded");
    expect(homeTodayStatusLabel("unrecorded")).toBe("未記録");
    expect(homeTodayFootnote("unrecorded", 0)).toBe("今日はまだ記録がありません");
    expect(homeMascotPose("unrecorded", false)).toBe("rest");
  });

  it("飲酒記録がある日は杯数を主にした記録あり表示にする", () => {
    expect(homeTodayStatus(2)).toBe("logged");
    expect(homeTodayStatusLabel("logged")).toBe("記録あり");
    expect(homeTodayFootnote("logged", 2)).toBe("今日は 2 杯記録しています");
    expect(homeMascotPose("logged", false)).toBe("default");
    expect(homeMascotPose("logged", true)).toBe("cheer");
  });
});

describe("homeWeekDayView", () => {
  it("今日と記録ありを独立した状態としてラベルに含める", () => {
    const today = homeWeekDayView(day({ date: "2026-09-08", count: 2 }), 1, "2026-09-08", false);
    expect(today.isToday).toBe(true);
    expect(today.hasRecord).toBe(true);
    expect(today.dayNumber).toBe(8);
    expect(today.weekday).toBe("火");
    expect(today.label).toBe("火曜日 8日 今日 2杯");
    expect(today.filling).toBe(false);
  });

  it("未記録の今日は記録なしと今日を同時に示す", () => {
    const today = homeWeekDayView(day({ date: "2026-09-08" }), 1, "2026-09-08", true);
    expect(today.hasRecord).toBe(false);
    expect(today.filling).toBe(true);
    expect(today.label).toBe("火曜日 8日 今日 記録なし");
  });

  it("未来日は無効化し、記録 0 件を休肝日とは呼ばない", () => {
    const future = homeWeekDayView(
      day({ date: "2026-09-09", isFuture: true }),
      2,
      "2026-09-08",
      false,
    );
    expect(future.isFuture).toBe(true);
    expect(future.hasRecord).toBe(false);
    expect(future.label).toBe("水曜日 9日 未来");
    expect(future.label).not.toContain("休肝");
  });
});
