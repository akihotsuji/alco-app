import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bottleNoteRowText, bottleNotesAllLabel } from "@/client/lib/bottle-notes.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottleNotesSection.tsx"),
  "utf8",
);

describe("BottleNotesSection T6", () => {
  it("見出しとすべて・行を仕様どおりに出す。作成は T3c だけ", () => {
    expect(source).toContain("ノート");
    expect(source).not.toContain("書く ›");
    expect(source).not.toContain("noteCreateHref");
    expect(source).toContain("notesListHref(bottleId)");
    expect(source).toContain("bottleNoteRowText");
    expect(source).toContain("bottleNotesAllLabel");
    expect(source).toContain("/notes/");
    expect(source).toContain("note.id");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(bottleNoteRowText("2026-08-01", 45)).toBe("2026-08-01  ★4.5");
    expect(bottleNotesAllLabel(3)).toBe("すべて（3）");
  });
});
