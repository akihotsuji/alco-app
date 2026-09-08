import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "NoteForm.tsx"), "utf8");

describe("NoteForm 写真先頭と AI / ビンテージ", () => {
  it("写真ストリップを銘柄より先に出し、折りたたみの間には置かない", () => {
    const photo = source.indexOf("<NotePhotoStrip");
    const name = source.indexOf('htmlFor="note-drink-name"');
    expect(photo).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(photo);
    expect(source).not.toContain("between={");
  });

  it("ビンテージ欄と写真からの推測がある", () => {
    expect(source).toContain('id="note-vintage"');
    expect(source).toContain("startNoteRecognition");
    expect(source).toContain("applyRecognizeToNoteForm");
    expect(source).toContain("NOTE_RECOGNIZE_BANNER");
  });

  it("関連付けは保存直前の任意行で、後選択は手入力を残す", () => {
    expect(source.indexOf("placement=\"optional\"")).toBeGreaterThan(source.indexOf("<NoteTextFields"));
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
  });
});
