import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const list = readFileSync(join(here, "NoteList.tsx"), "utf8");
const card = readFileSync(join(here, "NoteCard.tsx"), "utf8");

describe("NoteList 空状態と 404", () => {
  it("フィルタなし空は作成、検索 0 とフィルタ 0 は未登録と別。他人 bottleId は not-found", () => {
    expect(list).toContain("テイスティングノートはまだありません");
    expect(list).toContain("気になるお酒の味わいを記録してみましょう");
    expect(list).toContain("ノートを作成");
    expect(list).toContain("一致するノートがありません");
    expect(list).toContain("該当するノートがありません");
    expect(list).toContain("フィルタを解除");
    expect(list).toContain("clearFilters");
    expect(list).toContain("<NotFoundPage");
    expect(list).toContain('bottle.error.code === "not_found"');
    expect(list).toContain('query.error.code === "not_found"');
    expect(list).not.toContain("まだ他のノートはありません");
    expect(list).not.toContain("dangerouslySetInnerHTML");
  });

  it("カードは横並びで銘柄が主。写真に文字を重ねない。感想は taste", () => {
    expect(card).toContain("note-card-name");
    expect(card).toContain("note-card-taste");
    expect(card).toContain("item.taste");
    expect(card).toContain("formatRatingX10");
    expect(card).toContain("ContentPhoto");
    expect(card).toContain("PHOTO_DISPLAY_SIZE.noteCard");
    expect(card).not.toContain("Planeta");
    expect(card).not.toContain("dangerouslySetInnerHTML");
    expect(list).toContain("<NoteCard");
    expect(list).toContain("最近のノート");
  });
});
