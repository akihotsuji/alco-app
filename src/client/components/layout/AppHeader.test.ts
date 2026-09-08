import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const header = readFileSync(join(here, "AppHeader.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("AppHeader", () => {
  it("ノート作成はヘッダーに置かず、右下 FAB に揃える", () => {
    expect(header).not.toContain("header-create");
    expect(header).not.toContain("app-header-has-create");
    expect(css).not.toContain(".header-create");
    expect(css).not.toContain(".app-header-has-create");
  });
});
