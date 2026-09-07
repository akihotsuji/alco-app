import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DARK_COLOR_TOKENS,
  LIGHT_COLOR_TOKENS,
  MOTION_TOKENS,
  SHADCN_TOKEN_MAP,
} from "./design-tokens.ts";
import { MOTION_MS } from "./motion.ts";

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

/** 正本: 設定「外観」で解決された `html[data-theme="dark"]` */
function darkBlock(source: string): string {
  const match = source.match(/html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
  if (!match?.[1]) {
    throw new Error('html[data-theme="dark"] ブロックが見つかりません');
  }
  return match[1];
}

/** JS が data-theme を付ける前の初回描画用（OS がダークのとき）。正本と同じ値でなければならない */
function darkFallbackBlock(source: string): string {
  const match = source.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*html:not\(\[data-theme\]\)\s*\{([\s\S]*?)\n\s*\}/,
  );
  if (!match?.[1]) {
    throw new Error("prefers-color-scheme のフォールバックブロックが見つかりません");
  }
  return match[1];
}

function tokenEntries(block: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    entries[match[1] ?? ""] = (match[2] ?? "").trim();
  }
  return entries;
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

  it("ダークの色トークンが html[data-theme=dark] で一致する", () => {
    const block = darkBlock(css);
    for (const [name, value] of Object.entries(DARK_COLOR_TOKENS)) {
      expect(tokenValue(block, name)).toBe(value);
    }
  });

  it("初回描画用の prefers-color-scheme フォールバックが正本と同じ値を持つ", () => {
    const primary = tokenEntries(darkBlock(css));
    const fallback = tokenEntries(darkFallbackBlock(css));
    expect(Object.keys(primary).length).toBeGreaterThan(0);
    expect(fallback).toEqual(primary);
  });

  it("html に .dark を固定せず、テーマは data-theme で切り替える（06-settings S10）", () => {
    expect(html).not.toMatch(/<html[^>]*class=/);
    expect(html).not.toMatch(/<html[^>]*data-theme=/);
    expect(css).not.toMatch(/html\.dark/);
    expect(css).toContain(
      '@custom-variant dark (&:where(html[data-theme="dark"], html[data-theme="dark"] *))',
    );
    expect(css).toMatch(/html\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;/);
    expect(darkBlock(css)).toContain("color-scheme: dark;");
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

  it("ダークの --primary / --score / --ring が #cc8484（X8）", () => {
    const block = darkBlock(css);
    for (const name of ["--primary", "--score", "--ring"] as const) {
      expect(tokenValue(block, name)).toBe("#cc8484");
    }
    expect(css).not.toContain("#c47878");
  });

  it("モーショントークンが :root にあり、JS の MOTION_MS と一致する", () => {
    const block = rootBlock(css);
    for (const [name, value] of Object.entries(MOTION_TOKENS)) {
      expect(tokenValue(block, name), name).toBe(value);
    }
    const byName: Record<keyof typeof MOTION_MS, string> = {
      press: "--dur-press",
      release: "--dur-release",
      state: "--dur-state",
      enter: "--dur-enter",
      open: "--dur-open",
      fill: "--dur-fill",
      toastIn: "--dur-toast-in",
      toastOut: "--dur-toast-out",
      stagger: "--dur-stagger",
      highlightHold: "--dur-highlight-hold",
      highlightFade: "--dur-highlight-fade",
    };
    for (const [key, token] of Object.entries(byName)) {
      expect(tokenValue(block, token)).toBe(`${MOTION_MS[key as keyof typeof MOTION_MS]}ms`);
    }
  });

  it("reduced motion は html[data-reduce-motion] の 1 組に集約されている", () => {
    expect(css).toContain('html[data-reduce-motion="1"]');
    expect(css).not.toMatch(/@media\s*\(prefers-reduced-motion/);
  });

  it("その場の秒数を書かない（transition / animation はトークン経由）", () => {
    const body = css.replace(/:root\s*\{[\s\S]*?\n\}/g, "");
    // reduced motion の 0.01ms（仕様値）だけは例外
    const rawDurations = [
      ...body.matchAll(/(?:transition|animation)[^;]*?\b(?:\d+ms|\d*\.\d+s|\ds)\b/g),
    ]
      .map((m) => m[0])
      .filter((m) => !m.endsWith("0.01ms"));
    expect(rawDurations).toEqual([]);
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
