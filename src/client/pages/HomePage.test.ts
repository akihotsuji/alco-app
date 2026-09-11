import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HomePage.tsx"), "utf8");

describe("HomePage 順序", () => {
  it("今日の記録 → 今週 → マイドリンクの順を維持する", () => {
    const today = source.indexOf("<TodaySummaryCard");
    const week = source.indexOf("<HomeWeekStrip");
    const myDrinks = source.indexOf('className="home-mydrinks"');
    expect(today).toBeGreaterThan(-1);
    expect(week).toBeGreaterThan(today);
    expect(myDrinks).toBeGreaterThan(week);
  });

  it("独立した記録入口ボタンは置かず、取得中と失敗を未記録カードにしない", () => {
    expect(source).not.toContain("LogQuickActions");
    expect(source).not.toContain("お酒を記録する");
    expect(source).not.toContain("写真から記録");
    expect(source).not.toContain("useCaptureLog");
    expect(source.indexOf("summaryPending")).toBeLessThan(source.indexOf("<TodaySummaryCard"));
    expect(source.indexOf("summaryError")).toBeLessThan(source.indexOf("<TodaySummaryCard"));
    expect(source).toContain("CardSkeleton");
    expect(source).toContain("QueryError");
    expect(source).toContain("daySummary.data ?");
    expect(source).toContain("マイドリンクを登録");
    expect(source).toContain("登録したお酒をタップして飲酒記録を追加できます");
  });
});
