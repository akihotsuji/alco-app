import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyNoteToolbarParams } from "@/client/lib/history-state.ts";
import { DRINK_TYPE_LABELS, DRINK_TYPES } from "@/shared/constants.ts";

const here = dirname(fileURLToPath(import.meta.url));
const toolbar = readFileSync(join(here, "NoteToolbar.tsx"), "utf8");
const list = readFileSync(join(here, "NoteList.tsx"), "utf8");

describe("NoteToolbar 一覧フィルタ", () => {
  it("検索・種類・★4 以上で絞り、選択中の種類は「ワイン ×」", () => {
    expect(toolbar).toContain('aria-label="銘柄・メモで検索"');
    expect(toolbar).toContain("setQInput(event.target.value)");
    expect(toolbar).toContain("selectDrinkType(type)");
    expect(toolbar).toContain("clearDrinkType");
    expect(toolbar).toContain("toggleRatingMin");
    expect(toolbar).toContain("★4 以上");
    expect(toolbar).toContain("DRINK_TYPE_LABELS[drinkType]} ×");
    expect(list).toContain("<NoteToolbar");
    expect(list).toContain("filters.q");
    expect(list).toContain("filters.drinkType");
    expect(list).toContain("filters.ratingX10Min");
    for (const type of DRINK_TYPES) {
      expect(toolbar).toContain("DRINK_TYPE_LABELS[type]");
      expect(DRINK_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("ツールバー操作で q / drinkType / ratingX10Min が付く。bottleId は残す", () => {
    const bottle = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const withBottle = new URLSearchParams(`bottleId=${bottle}`);
    expect(applyNoteToolbarParams(withBottle, { type: "setQuery", q: "赤" })?.get("q")).toBe("赤");
    expect(
      applyNoteToolbarParams(withBottle, { type: "selectDrinkType", drinkType: "wine" })?.get(
        "drinkType",
      ),
    ).toBe("wine");
    expect(
      applyNoteToolbarParams(withBottle, { type: "toggleRatingMin" })?.get("ratingX10Min"),
    ).toBe("40");
    const cleared = applyNoteToolbarParams(
      new URLSearchParams(`bottleId=${bottle}&q=赤&drinkType=wine&ratingX10Min=40`),
      { type: "clearFilters" },
    );
    expect(cleared?.get("bottleId")).toBe(bottle);
    expect(cleared?.get("q")).toBeNull();
    expect(cleared?.get("drinkType")).toBeNull();
    expect(cleared?.get("ratingX10Min")).toBeNull();
  });
});
