import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "TodaySummaryCard.tsx"),
  "utf8",
);

describe("TodaySummaryCard", () => {
  it("カード全体を単一リンクにし、リンク内にボタンを置かない", () => {
    expect(source).toContain('className="home-today-link"');
    expect(source).toContain("homeTodayHref(status)");
    expect(source).not.toContain("<Button");
    expect(source).not.toContain("<button");
  });

  it("狭い幅では数字を縮小せず折り返せる", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
      "utf8",
    );
    expect(css).toContain(".home-today-layout");
    expect(css).toContain("flex-wrap: wrap");
    expect(css).toContain("flex: 1 1 12rem");
  });

  it("未記録は 0杯・0.0g・状態バッジを出さず、記録作成へつなぐ", () => {
    expect(source).toContain('status === "logged"');
    expect(source).toContain("homeTodayFootnote");
    expect(source).toContain("homeTodayActionLabel");
    expect(source).not.toContain("未記録");
    expect(source).not.toContain("記録あり");
    expect(source).not.toContain("今日は N");
    expect(source).not.toContain("純アルコール</");
    expect(source).toContain("純アルコール量");
  });
});
