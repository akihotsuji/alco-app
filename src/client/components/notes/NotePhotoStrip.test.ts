import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NOTE_PHOTO_LIMIT_MESSAGE } from "@/client/lib/note-photos.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const strip = readFileSync(join(dir, "NotePhotoStrip.tsx"), "utf8");
const form = readFileSync(join(dir, "NoteForm.tsx"), "utf8");
const carousel = readFileSync(join(dir, "NotePhotoCarousel.tsx"), "utf8");
const styles = readFileSync(join(dir, "../../styles.css"), "utf8");
const edit = readFileSync(join(dir, "../photo/PhotoEdit.tsx"), "utf8");

describe("ノート写真ストリップ / カルーセル", () => {
  it("撮るタイルと先頭化メニューを出し、6 枚で撮るを止める", () => {
    expect(strip).toContain("撮る");
    expect(strip).toContain("先頭にする");
    expect(strip).toContain("NOTE_PHOTO_LIMIT_MESSAGE");
    expect(strip).toContain("disabled={!canAdd}");
    expect(form).toContain("<NotePhotoStrip");
    expect(form).toContain("photos.photoIds");
    expect(form).not.toContain("dangerouslySetInnerHTML");
    expect(NOTE_PHOTO_LIMIT_MESSAGE).toBe("写真は 6 枚までです");
  });

  it("詳細は scroll-snap のカルーセルで、写真なしでは出さない", () => {
    expect(carousel).toContain("note-photo-carousel-scroller");
    expect(styles).toContain("scroll-snap-type: x mandatory");
    expect(carousel).toContain("loading={photoIndex === 0 ? \"eager\" : \"lazy\"}");
    expect(carousel).toContain("if (photos.length === 0)");
    expect(carousel).toContain("return null");
    expect(edit).toContain("kind !== \"cellar\"");
    expect(edit).toContain("キャラを入れる");
  });
});
