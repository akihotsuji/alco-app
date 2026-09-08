import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const host = readFileSync(join(here, "FirstRunGuideHost.tsx"), "utf8");

describe("FirstRunGuideHost", () => {
  it("招待・記録ボタン・練習・完了の文言がある", () => {
    expect(host).toContain("使い方を少し試してみますか？");
    expect(host).toContain("操作を試す");
    expect(host).toContain("今はしない");
    expect(host).toContain("PracticeLogForm");
    expect(host).toContain("基本の操作はこれだけです");
    expect(host).toContain("ガイドを終了");
    expect(host).not.toContain("setTimeout");
    expect(host).not.toContain("セラー");
  });
});
