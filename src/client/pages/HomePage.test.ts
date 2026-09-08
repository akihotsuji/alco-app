import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "HomePage.tsx"), "utf8");

describe("HomePage 順序", () => {
  it("今日の記録 → 記録操作 → 今週 → マイドリンクの順を維持する", () => {
    const today = source.indexOf("<TodaySummaryCard");
    const actions = source.indexOf("<LogQuickActions");
    const week = source.indexOf("<HomeWeekStrip");
    const myDrinks = source.indexOf('className="home-mydrinks"');
    expect(today).toBeGreaterThan(-1);
    expect(actions).toBeGreaterThan(today);
    expect(week).toBeGreaterThan(actions);
    expect(myDrinks).toBeGreaterThan(week);
  });
});
