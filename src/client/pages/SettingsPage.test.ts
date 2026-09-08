import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "SettingsPage.tsx"),
  "utf8",
);

describe("SettingsPage S11", () => {
  it("操作節に使い方を見るがあり、扇からツアーを始める", () => {
    expect(source).toContain("使い方を見る");
    expect(source).toContain("GuideFanMenu");
    expect(source).toContain("guide.openPicker");
    expect(source).toContain("guide.startTour");
    expect(source).not.toContain("guide.replay()");
    expect(source).not.toContain("健康");
  });
});
