import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "SettingsPage.tsx"),
  "utf8",
);

describe("SettingsPage S11 / S12", () => {
  it("操作節に使い方を見るがあり、扇からツアーを始める", () => {
    expect(source).toContain("使い方を見る");
    expect(source).toContain("GuideFanMenu");
    expect(source).toContain("guide.openPicker");
    expect(source).toContain("guide.startTour");
    expect(source).not.toContain("guide.replay()");
    expect(source).not.toContain("健康");
  });

  it("記録節に現在地を記録するがある", () => {
    expect(source).toContain("記録");
    expect(source).toContain("RecordLocationPrefRow");
    expect(source.indexOf('<h2 className="settings-heading">記録</h2>')).toBeGreaterThan(
      source.indexOf('<h2 className="settings-heading">セラー</h2>'),
    );
    expect(source.indexOf('<h2 className="settings-heading">表示</h2>')).toBeGreaterThan(
      source.indexOf('<h2 className="settings-heading">記録</h2>'),
    );
  });
});
