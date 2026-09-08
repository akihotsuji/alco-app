import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "PracticeBottleForm.tsx"),
  "utf8",
);

describe("PracticeBottleForm", () => {
  it("練習専用で保存 API を呼ばず、種類と保存にガイド対象がある", () => {
    expect(source).toContain("練習中・保存されません");
    expect(source).toContain('? "drink-type"');
    expect(source).toContain('? "save"');
    expect(source).toContain("練習として並べる（保存されません）");
    expect(source).not.toContain("useCreateBottle");
    expect(source).not.toContain("startCapture");
    expect(source).not.toContain("form-lead");
  });
});
