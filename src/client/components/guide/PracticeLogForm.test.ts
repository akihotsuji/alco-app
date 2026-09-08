import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PracticeLogForm.tsx"),
  "utf8",
);

describe("PracticeLogForm", () => {
  it("練習専用で保存 API と写真を呼ばず、量と保存にガイド対象がある", () => {
    expect(source).toContain("練習中・保存されません");
    expect(source).toContain("guideStepProgress");
    expect(source).toContain('guide.step === "practice-volume" ? "volume"');
    expect(source).toContain('guide.step === "practice-save" ? "save"');
    expect(source).toContain("練習として保存（記録されません）");
    expect(source).toContain("VolumeField");
    expect(source).not.toContain("useCreateDrinkLog");
    expect(source).not.toContain("startCapture");
    expect(source).not.toContain("startDrinkRecognition");
    expect(source).not.toContain("CompactPhotoField");
    expect(source).not.toContain("記録を保存");
    expect(source).not.toContain("form-lead");
  });
});
