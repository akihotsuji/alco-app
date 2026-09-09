import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "AgePage.tsx"), "utf8");

describe("AgePage", () => {
  it("要素表どおりの見出し・説明・入力・ログアウトがある", () => {
    expect(source).toContain('htmlFor="age-birth-on"');
    expect(source).toContain('autoComplete="bday"');
    expect(source).toContain('type="date"');
    expect(source).toContain("年齢確認");
    expect(source).toContain("酒類の記録のため、20歳以上の方のみ利用できます。");
    expect(source).toContain("ご利用いただけません");
    expect(source).toContain("20歳未満の方は本サービスをご利用いただけません。");
    expect(source).toContain("生年月日を修正");
    expect(source).toContain("ログアウト");
    expect(source).toContain("endSession");
    expect(source).not.toContain("もう一杯");
    expect(source).not.toContain('pose="surprised"');
  });
});
