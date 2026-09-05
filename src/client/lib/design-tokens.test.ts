import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DARK_COLOR_TOKENS, LIGHT_COLOR_TOKENS, SHADCN_TOKEN_MAP } from "./design-tokens.ts";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "../styles.css");
const css = readFileSync(cssPath, "utf8");
const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../index.html"),
  "utf8",
);

function rootBlock(source: string): string {
  const match = source.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!match?.[1]) {
    throw new Error(":root ブロックが見つかりません");
  }
  return match[1];
}

function darkBlock(source: string): string {
  const match = source.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/,
  );
  if (!match?.[1]) {
    throw new Error("ダークの :root ブロックが見つかりません");
  }
  return match[1];
}

function tokenValue(block: string, name: string): string {
  const match = block.match(new RegExp(`${name.replace("-", "\\-")}:\\s*([^;]+);`));
  if (!match?.[1]) {
    throw new Error(`${name} がありません`);
  }
  return match[1].trim();
}

describe("design tokens", () => {
  it("ライトの色トークンが design-system と一致する", () => {
    const block = rootBlock(css);
    for (const [name, value] of Object.entries(LIGHT_COLOR_TOKENS)) {
      expect(tokenValue(block, name)).toBe(value);
    }
  });

  it("ダークの色トークンが prefers-color-scheme で一致する", () => {
    const block = darkBlock(css);
    for (const [name, value] of Object.entries(DARK_COLOR_TOKENS)) {
      expect(tokenValue(block, name)).toBe(value);
    }
  });

  it("html に .dark を固定しない", () => {
    expect(html).not.toMatch(/<html[^>]*class=/);
    expect(css).not.toMatch(/html\.dark/);
    expect(css).toContain("@custom-variant dark (@media (prefers-color-scheme: dark))");
  });

  it("shadcn 対応表が design-system の写しになっている", () => {
    expect(SHADCN_TOKEN_MAP.background).toBe("--background");
    expect(SHADCN_TOKEN_MAP.card).toBe("--background");
    expect(SHADCN_TOKEN_MAP.primary).toBe("--primary");
    expect(SHADCN_TOKEN_MAP["primary-foreground"]).toBe("--primary-fg");
    expect(SHADCN_TOKEN_MAP.destructive).toBe("--danger");
    expect(SHADCN_TOKEN_MAP["muted-foreground"]).toBe("--muted");
    expect(SHADCN_TOKEN_MAP.radius).toBe("--radius");
  });

  it("1-07 / 1-08 追補トークンがある", () => {
    const block = rootBlock(css);
    expect(tokenValue(block, "--mascot-line")).toBe("var(--foreground)");
    expect(tokenValue(block, "--mascot-glow")).toBe("rgba(255, 255, 255, 0.6)");
    expect(tokenValue(block, "--shelf-ghost")).toBe("rgba(43, 38, 31, 0.07)");
    expect(tokenValue(block, "--tab-center-size")).toBe("60px");
    expect(tokenValue(block, "--radius-photo")).toBe("20px");
    expect(tokenValue(block, "--tab-h")).toBe("72px");
  });
});
