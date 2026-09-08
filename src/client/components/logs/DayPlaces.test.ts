import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "DayPlaces.tsx"), "utf8");

describe("DayPlaces", () => {
  it("その日いた場所を出し、自前生成 URL だけ描く", () => {
    expect(source).toContain("placesForDay");
    expect(source).toContain("isSafeGoogleMapsHref");
    expect(source).toContain("PLACE_UI.dayHeading");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noreferrer"');
    expect(source).not.toContain("Google マップで開く");
  });
});
