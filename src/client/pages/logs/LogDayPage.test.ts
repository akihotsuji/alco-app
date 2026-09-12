import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "LogDayPage.tsx"),
  "utf8",
);

describe("LogDayPage D10", () => {
  it("その日いた場所は出さず、行の中にマップリンクは置かない", () => {
    expect(source).not.toContain("DayPlaces");
    expect(source).not.toContain("その日いた場所");
    expect(source).not.toContain("googleMapsSearchUrl");
    expect(source).toContain("item.placeName");
  });

  it("サムネタップは拡大で、行本文は編集へ進む", () => {
    expect(source).toContain("PhotoViewer");
    expect(source).toContain("log-row-thumb-button");
    expect(source).toContain("log-row-main");
    expect(source).toContain("写真を拡大");
  });
});
