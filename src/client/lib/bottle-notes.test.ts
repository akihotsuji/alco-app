import { describe, expect, it } from "vitest";
import { bottleNoteRowText, bottleNotesAllLabel } from "./bottle-notes.ts";

describe("bottleNoteRowText / bottleNotesAllLabel", () => {
  it("日付と評価を T6 の行文言にする", () => {
    expect(bottleNoteRowText("2026-08-01", 45)).toBe("2026-08-01  ★4.5");
    expect(bottleNoteRowText("2026-09-07", 40)).toBe("2026-09-07  ★4.0");
  });

  it("総数を「すべて（N）」にする", () => {
    expect(bottleNotesAllLabel(0)).toBe("すべて（0）");
    expect(bottleNotesAllLabel(12)).toBe("すべて（12）");
  });
});
