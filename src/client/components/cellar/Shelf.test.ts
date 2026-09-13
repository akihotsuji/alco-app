import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const shelf = readFileSync(join(here, "Shelf.tsx"), "utf8");
const tile = readFileSync(join(here, "BottleTile.tsx"), "utf8");
const list = readFileSync(join(here, "CellarList.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("Shelf / BottleTile / CellarList", () => {
  it("段の棚板ハイライトとタイル出現を data 属性で発火する", () => {
    expect(shelf).toContain("data-highlight");
    expect(shelf).toContain('layout === "type"');
    expect(shelf).toContain("shelf-ghost");
    expect(shelf).toContain("shelf-ghost-open");
    expect(shelf).toContain("onOpenType");
    expect(list).toContain("openGrid");
    expect(list).toContain("TypeShelfHeading");
    expect(tile).toContain("data-enter");
    expect(tile).toContain("ContentPhoto");
    expect(tile).toContain("PHOTO_DISPLAY_SIZE.bottleTile");
    expect(tile).toContain("suppressNativePress");
    expect(tile).toContain("onContextMenu");
    expect(tile).toContain("data-press-safe");
    expect(tile).toContain("bottle-tile-press-shield");
    expect(css).toContain(".bottle-tile-press-shield");
    expect(css).toContain(".type-grid-cell img");
    expect(css).toContain("-webkit-touch-callout: none");
    expect(css).toContain(".type-grid-row .shelf-board");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain("text-overflow: ellipsis");
  });

  it("空状態と種類ごと / 1 本ずつの切替がある", () => {
    expect(list).toContain("cellar-empty");
    expect(list).toContain("ボトルはまだありません");
    expect(list).toContain('hideTypeFilter={view === "type"}');
    expect(list).toContain('layout="type"');
  });
});
