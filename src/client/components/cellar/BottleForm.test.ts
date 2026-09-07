import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INITIAL_BOTTLE_FORM, validateBottleForm } from "@/client/lib/bottle-form.ts";
import { BOTTLE_MESSAGES } from "@/shared/bottles.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottleForm.tsx"),
  "utf8",
);

describe("BottleForm バリデーション表示", () => {
  it("フィールド直下に field-error を出し、保存は canSubmit で無効化する", () => {
    expect(source).toContain("validateBottleForm(state)");
    expect(source).toContain("canSubmitBottleForm");
    expect(source).toContain("errors.name");
    expect(source).toContain("errors.vintage");
    expect(source).toContain("errors.purchasedOn");
    expect(source).toContain('className="field-error"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("disabled={!canSubmit}");
    expect(validateBottleForm(INITIAL_BOTTLE_FORM).name).toBe(BOTTLE_MESSAGES.name);
  });

  it("追加時だけ読み取り帯を出し、AI 印は触ると消える欄に付ける", () => {
    expect(source).toContain('mode === "new" && recognizeStatus');
    expect(source).toContain("<RecognizeBanner");
    expect(source).toContain("FieldWithAiMark");
    expect(source).toContain('className="pill ai"');
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
