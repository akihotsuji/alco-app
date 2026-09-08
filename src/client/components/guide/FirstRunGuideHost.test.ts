import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const host = readFileSync(join(here, "FirstRunGuideHost.tsx"), "utf8");

describe("FirstRunGuideHost", () => {
  it("招待・スポットライト・練習・完了と他機能への導線がある", () => {
    expect(host).toContain("使い方を少し試してみますか？");
    expect(host).toContain("操作を試す");
    expect(host).toContain("今はしない");
    expect(host).toContain("GuideSpotlight");
    expect(host).toContain("PracticeLogForm");
    expect(host).toContain("PracticeBottleForm");
    expect(host).toContain("PracticeNoteForm");
    expect(host).toContain("ほかの使い方を見る");
    expect(host).toContain("ガイドを終了");
    expect(host).not.toContain("setTimeout");
  });
});
