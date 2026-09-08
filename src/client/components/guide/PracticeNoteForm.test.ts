import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PracticeNoteForm.tsx"),
  "utf8",
);

describe("PracticeNoteForm", () => {
  it("練習専用で保存 API を呼ばず、評価と保存にガイド対象がある", () => {
    expect(source).toContain("練習中・保存されません");
    expect(source).toContain('guideTarget="rating"');
    expect(source).toContain('guideTarget="save"');
    expect(source).toContain("練習として保存（記録されません）");
    expect(source).not.toContain("useCreateTastingNote");
    expect(source).not.toContain("startCapture");
  });
});
