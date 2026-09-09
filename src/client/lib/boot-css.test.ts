import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DARK_COLOR_TOKENS, LIGHT_COLOR_TOKENS } from "./design-tokens.ts";

const bootCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../public/boot.css"),
  "utf8",
);

describe("boot.css", () => {
  it("data-theme 付きの html/body/#root には色を残さない（本 CSS より強いため）", () => {
    expect(bootCss).toContain("html:not([data-theme])");
    expect(bootCss).not.toMatch(/html,\s*body,\s*#root/);
    expect(bootCss).not.toMatch(/html,\s*body,\s*\.auth-boot/);
  });

  it("起動中のダーク文字は地色ベージュではなくダークの --foreground", () => {
    expect(bootCss).toContain(LIGHT_COLOR_TOKENS["--background"]);
    expect(bootCss).toContain(LIGHT_COLOR_TOKENS["--foreground"]);
    expect(bootCss).toContain(DARK_COLOR_TOKENS["--background"]);
    expect(bootCss).toContain(DARK_COLOR_TOKENS["--foreground"]);
    const darkSection = bootCss.slice(bootCss.indexOf("prefers-color-scheme: dark"));
    expect(darkSection).not.toContain(`color: ${LIGHT_COLOR_TOKENS["--background"]}`);
  });
});
