import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const detail = readFileSync(join(here, "NoteDetail.tsx"), "utf8");
const styles = readFileSync(join(here, "../../styles.css"), "utf8");

describe("NoteDetail 4 欄とボトル行", () => {
  it("値のある欄だけを 外観 / 香り / 味わい / 余韻 の順でテキスト描画する", () => {
    const appearance = detail.indexOf('label: "外観"');
    const aroma = detail.indexOf('label: "香り"');
    const taste = detail.indexOf('label: "味わい"');
    const finish = detail.indexOf('label: "余韻"');
    expect(appearance).toBeGreaterThan(-1);
    expect(aroma).toBeGreaterThan(appearance);
    expect(taste).toBeGreaterThan(aroma);
    expect(finish).toBeGreaterThan(taste);
    expect(detail).toContain("まだ書いていません");
    expect(detail).toContain("{field.value}");
    expect(detail).not.toContain("dangerouslySetInnerHTML");
    expect(styles).toContain(".note-detail-fields dd");
    expect(styles).toContain("white-space: pre-wrap");
  });

  it("ボトルがあるときだけセラー / 貯蔵庫の行を出し、他人は not-found", () => {
    expect(detail).toContain("セラーのボトル");
    expect(detail).toContain("貯蔵庫のボトル");
    expect(detail).toContain("/cellar/");
    expect(detail).toContain("note.bottle.id");
    expect(detail).toContain("<NotFoundPage");
    expect(detail).toContain('query.error.code === "not_found"');
  });
});
