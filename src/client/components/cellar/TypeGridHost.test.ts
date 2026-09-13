import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const host = readFileSync(join(here, "TypeGridHost.tsx"), "utf8");
const overlay = readFileSync(join(here, "TypeGridOverlay.tsx"), "utf8");
const shell = readFileSync(join(here, "../layout/AppShell.tsx"), "utf8");

describe("TypeGridHost", () => {
  it("開いているときだけ種類グリッドを dynamic import する", () => {
    expect(host).toContain('import("@/client/components/cellar/TypeGridOverlay.tsx")');
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
    expect(overlay).toContain("TYPE_GRID_LONG_PRESS_MS");
    expect(overlay).toContain("pagehide");
    expect(overlay).toContain("visibilitychange");
  });
});
