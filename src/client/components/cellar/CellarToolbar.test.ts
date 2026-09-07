import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRINK_TYPE_LABELS, DRINK_TYPES } from "@/shared/constants.ts";

const here = dirname(fileURLToPath(import.meta.url));
const toolbar = readFileSync(join(here, "CellarToolbar.tsx"), "utf8");
const list = readFileSync(join(here, "CellarList.tsx"), "utf8");

describe("CellarToolbar", () => {
  it("検索入力と種類チップで絞り、種類ごと表示では種類フィルタを隠す", () => {
    expect(toolbar).toContain('aria-label="検索"');
    expect(toolbar).toContain("setQInput(event.target.value)");
    expect(toolbar).toContain("selectDrinkType(type)");
    expect(toolbar).toContain("clearDrinkType");
    expect(toolbar).toContain("hideTypeFilter");
    expect(list).toContain('hideTypeFilter={view === "type"}');
    for (const type of DRINK_TYPES) {
      expect(toolbar).toContain("DRINK_TYPE_LABELS[type]");
      expect(DRINK_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("選択中の種類は「ワイン ×」になり、表示切替は 2 択", () => {
    expect(toolbar).toContain("DRINK_TYPE_LABELS[drinkType]} ×");
    expect(toolbar).toContain("種類ごと");
    expect(toolbar).toContain("1 本ずつ");
    expect(toolbar).toContain("aria-pressed={listView === view}");
  });
});
