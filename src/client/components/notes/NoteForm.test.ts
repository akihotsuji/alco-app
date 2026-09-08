import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "NoteForm.tsx"), "utf8");

describe("NoteForm 写真先頭と AI / 識別", () => {
  it("写真ストリップを銘柄より先に出し、折りたたみの間には置かない", () => {
    const photo = source.indexOf("<NotePhotoStrip");
    const name = source.indexOf('htmlFor="note-drink-name"');
    expect(photo).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(photo);
    expect(source).not.toContain("between={");
  });

  it("識別 4 項目と写真からの推測がある", () => {
    expect(source).toContain('idPrefix="note"');
    expect(source).toContain("IDENTITY_FIELD_LABELS.drinkName");
    expect(source).toContain("startNoteRecognition");
    expect(source).toContain("applyRecognizeToNoteForm");
    expect(source).toContain("latestNoteRecognizeJpeg");
    expect(source).toContain("NOTE_RECOGNIZE_BANNER");
    expect(source).toContain("capturedAtToCalendarDate");
    expect(source).toContain("fromLog");
    expect(source).toContain("inheritPhotoId");
    expect(source).toContain("inheritFrom");
  });

  it("関連付けは種類の次。後選択は手入力を残す", () => {
    expect(source.indexOf("<BottlePickerRow")).toBeGreaterThan(source.indexOf("<DrinkTypeSelect"));
    expect(source.indexOf("<IdentityFields")).toBeGreaterThan(source.indexOf("<BottlePickerRow"));
    expect(source.indexOf("<NoteTextFields")).toBeGreaterThan(source.indexOf("<IdentityFields"));
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
  });
});
