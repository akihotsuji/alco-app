import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const list = readFileSync(join(here, "NoteList.tsx"), "utf8");
const card = readFileSync(join(here, "NoteCard.tsx"), "utf8");

describe("NoteList 空状態と 404", () => {
  it("フィルタなし空は作成、フィルタ 0 は解除。他人 bottleId は not-found", () => {
    expect(list).toContain("テイスティングノートはまだありません。撮って一言から");
    expect(list).toContain("該当するノートがありません");
    expect(list).toContain("フィルタを解除");
    expect(list).toContain("clearFilters");
    expect(list).toContain("<NotFoundPage");
    expect(list).toContain('bottle.error.code === "not_found"');
    expect(list).toContain('query.error.code === "not_found"');
    expect(list).not.toContain("dangerouslySetInnerHTML");
  });

  it("カードは写真の下に銘柄と評価。写真に文字を重ねない", () => {
    expect(card).toContain("note-card-name");
    expect(card).toContain("formatRatingX10");
    expect(card).toContain('loading="lazy"');
    expect(card).not.toContain("dangerouslySetInnerHTML");
    expect(list).toContain("<NoteCard");
  });
});
