import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "LogDayPage.tsx"),
  "utf8",
);

describe("LogDayPage D10", () => {
  it("合計の下にその日いた場所を出し、行の中にマップリンクは置かない", () => {
    expect(source).toContain("DayPlaces");
    expect(source.indexOf("<DayPlaces")).toBeGreaterThan(source.indexOf("log-day-total"));
    expect(source.indexOf("<DayPlaces")).toBeLessThan(source.indexOf("log-list"));
    expect(source).not.toContain("googleMapsSearchUrl");
  });
});
