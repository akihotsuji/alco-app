import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "NoteForm.tsx"), "utf8");

describe("NoteForm は記録フォームへリダイレクトする", () => {
  it("新規は log-new へ、編集は親記録の log-edit へ行く", () => {
    expect(source).toContain("logCreateHref");
    expect(source).toContain("<Navigate");
    expect(source).toContain("/logs/entries/");
    expect(source).toContain("query.data.drinkLog.id");
    expect(source).not.toContain("fromLog");
    expect(source).not.toContain("<NotePhotoStrip");
    expect(source).not.toContain("startNoteRecognition");
    expect(source).not.toContain("ノートを保存");
  });
});
