import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PlaceField.tsx"),
  "utf8",
);

describe("PlaceField", () => {
  it("座標ありは記録済みと地図で見る。Google マップで開くは使わない", () => {
    expect(source).toContain("PLACE_UI.recorded");
    expect(source).toContain("placeMapsLinkLabel");
    expect(source).toContain("isSafeGoogleMapsHref");
    expect(source).toContain("MapPin");
    expect(source).not.toContain("Google マップで開く");
  });
});
