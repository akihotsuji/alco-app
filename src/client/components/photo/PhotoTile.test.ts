import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tile = readFileSync(join(here, "PhotoTile.tsx"), "utf8");
describe("PhotoTile 撮影とライブラリ", () => {
  it("空タイルは撮影が主で、ライブラリからを副導線として出せる", () => {
    expect(tile).toContain("写真を撮る");
    expect(tile).toContain("onLibraryClick");
    expect(tile).toContain("IMAGE_PICK_LABELS.library");
  });
});
