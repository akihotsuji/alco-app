import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const header = readFileSync(join(here, "AppHeader.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("AppHeader", () => {
  it("保存後フォーカス用に見出し id を持ち、アイコンは tap-min", () => {
    expect(header).toContain("APP_HEADER_TITLE_ID");
    expect(header).toContain("tabIndex={-1}");
    expect(css).toContain("grid-template-columns: var(--tap-min) 1fr var(--tap-min)");
    expect(css).toContain(".app-header-spacer");
    expect(css).toContain("width: var(--tap-min)");
  });

  it("ノート作成はヘッダーに置かず、右下 FAB に揃える", () => {
    expect(header).not.toContain("header-create");
    expect(header).not.toContain("app-header-has-create");
    expect(css).not.toContain(".header-create");
    expect(css).not.toContain(".app-header-has-create");
  });
});
