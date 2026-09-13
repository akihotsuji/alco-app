import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const host = readFileSync(join(here, "TypeGridHost.tsx"), "utf8");
const overlay = readFileSync(join(here, "TypeGridOverlay.tsx"), "utf8");
const preview = readFileSync(join(here, "TypeGridDragPreview.tsx"), "utf8");
const hook = readFileSync(join(here, "../../hooks/use-type-grid-drag.ts"), "utf8");
const shell = readFileSync(join(here, "../layout/AppShell.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("TypeGridHost", () => {
  it("開いているときだけ種類グリッドを dynamic import する", () => {
    expect(host).toContain("@/client/components/cellar/TypeGridOverlay.tsx");
    expect(host).toContain("if (!open)");
    expect(host).toContain("return null");
    expect(shell).toContain("TypeGridHost");
    expect(shell).not.toContain('from "@/client/components/cellar/TypeGridOverlay.tsx"');
  });

  it("完了と長押し案内があり、検索中は並べ替えない", () => {
    expect(overlay).toContain("完了");
    expect(overlay).toContain("長押しして並べ替え");
    expect(overlay).toContain("searchActive");
    expect(overlay).toContain("useReorderBottles");
    expect(overlay).toContain("pagehide");
    expect(overlay).toContain("visibilitychange");
    expect(overlay).toContain("suppressNativePress");
    expect(overlay).toContain("useTypeGridDrag");
    expect(overlay).toContain("TypeGridDragPreview");
    expect(overlay).toContain("並べ替え");
    expect(overlay).toContain("決定");
    expect(overlay).toContain("aria-live");
    expect(hook).toContain("TYPE_GRID_LONG_PRESS_MS");
    expect(hook).toContain("advanceTypeGridGesture");
    expect(hook).toContain("capturePointerSafe");
    expect(hook).toContain("shiftRectsForScroll");
    expect(hook).toContain("followLayerPosition");
    expect(preview).toContain("aria-hidden");
    expect(preview).toContain("BottleTileFace");
  });

  it("種類グリッドの棚板は横一杯、タイル名は1行省略", () => {
    expect(css).toContain(".type-grid-board");
    expect(css).toContain(".type-grid-follow");
    expect(css).toContain('.type-grid-cell[data-reorder="1"]');
    expect(css).not.toContain(".type-grid {\n  touch-action: none;");
    expect(css).not.toContain(".type-grid {\n  touch-action: pan-y;");
    expect(css).toMatch(/\.type-grid-cell\[data-reorder="1"\] \{[\s\S]*?touch-action: none;/);
    expect(css).toMatch(/\.bottle-tile-name,[\s\S]*?text-overflow: ellipsis/);
  });
});
