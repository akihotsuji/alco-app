import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const header = readFileSync(join(here, "AppHeader.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("AppHeader ノート一覧の作成ボタン", () => {
  it("「＋ 作成」は折り返さず、右スロット幅を広げる", () => {
    expect(header).toContain("app-header-has-create");
    expect(header).toContain('className="header-create"');
    expect(css).toContain(".app-header-has-create");
    expect(css).toMatch(/\.header-create\s*\{[^}]*white-space:\s*nowrap/s);
    expect(css).toContain("flex-flow: row nowrap");
    expect(css).toContain(".app-header:has(.header-create)");
  });
});
