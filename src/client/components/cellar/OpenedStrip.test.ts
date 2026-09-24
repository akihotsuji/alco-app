import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const strip = readFileSync(join(here, "OpenedStrip.tsx"), "utf8");
const list = readFileSync(join(here, "CellarList.tsx"), "utf8");
const home = readFileSync(join(here, "../../pages/HomePage.tsx"), "utf8");
const logForm = readFileSync(join(here, "../logs/LogNewForm.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("味わい中の丸アイコン（bottle-tasting.md C15 / H14）", () => {
  it("0 本なら何も出さない。写真に文字を重ねず、品名はアクセシブル名だけ。タップで詳細", () => {
    expect(strip).toContain("if (items.length === 0) {\n    return null;");
    expect(strip).toContain("aria-label={item.name}");
    expect(strip).toMatch(/to=\{`\/cellar\/\$\{item\.id\}`\}/);
    expect(strip).toContain('export const OPENED_STRIP_HEADING = "味わい中"');
    expect(strip).not.toContain("<Mascot");
    expect(strip).not.toContain("{item.name}</");
  });

  it("丸 44px・cover。加わった 1 本だけ M-39。動きを減らす設定ではフェードだけ", () => {
    expect(css).toMatch(/\.opened-strip-item \{[^}]*width: var\(--tap-min\);/);
    expect(css).toMatch(/\.opened-strip-item \{[^}]*border-radius: var\(--radius-pill\);/);
    expect(css).toMatch(/\.opened-strip-img \{[^}]*object-fit: cover;/);
    expect(css).toContain(
      '.opened-strip-item[data-enter="1"] {\n  animation: bottle-place var(--dur-enter) var(--ease-out) both;',
    );
    expect(css).toContain('html[data-reduce-motion="1"] .opened-strip-item[data-enter="1"]');
  });

  it("セラーは棚の陳列に混ぜず上部に置き、ヘッダーの本数は未開栓 + 味わい中", () => {
    expect(list).toContain('view: "opened"');
    expect(list.indexOf("<OpenedStrip")).toBeLessThan(list.indexOf("cellar-filter-disclosure"));
    expect(list).toContain("actualCount + (openedCount ?? 0)");
    expect(list).toContain("setOpenedEnterId(left.bottleId)");
  });

  it("ホームは今週の下・マイドリンクの上。参加しているすべてのセラーから", () => {
    expect(home).toContain('view: "opened"');
    expect(home).toContain('scope: "accessible"');
    expect(home.indexOf("HomeWeekStrip today")).toBeLessThan(home.indexOf("<OpenedStrip"));
    expect(home.indexOf("<OpenedStrip")).toBeLessThan(home.indexOf("home-mydrinks"));
  });

  it("記録: 味わい中は「このボトルを飲み切った」、未開栓は保存後に開栓する補足", () => {
    expect(logForm).toContain('bottleStatus === "opened"');
    expect(logForm).toContain("BOTTLE_LOG_ACTION_LABELS.finishSwitch");
    expect(logForm).toContain('bottleStatus === "sealed"');
    expect(logForm).toContain("BOTTLE_LOG_ACTION_LABELS.openNote");
    expect(logForm).toContain("bottleActionAfterLog(");
  });
});
