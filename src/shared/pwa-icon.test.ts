import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PWA_ICON_BACKGROUND,
  PWA_ICON_LINE,
  PWA_ICON_SIZE,
  PWA_SHORTCUT_ICON_ACCENT,
  PWA_SHORTCUT_ICON_GLYPH,
  PWA_SHORTCUT_ICON_SIZE,
} from "./pwa.ts";
import { buildPwaIconSvg, buildPwaShortcutIconSvg, extractSvgInner } from "./pwa-icon.ts";

const mascot = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../spec/assets/character/mascot-default.svg"),
  "utf8",
);

describe("buildPwaIconSvg", () => {
  it("通常ポーズをクリーム正方形に載せる", () => {
    const svg = buildPwaIconSvg(mascot);
    expect(svg).toContain(`viewBox="0 0 ${PWA_ICON_SIZE} ${PWA_ICON_SIZE}"`);
    expect(svg).toContain(`fill="${PWA_ICON_BACKGROUND}"`);
    expect(svg).toContain(`color="${PWA_ICON_LINE}"`);
    expect(svg).toContain("#8E2F3C");
    expect(svg).toContain(
      `<rect width="${PWA_ICON_SIZE}" height="${PWA_ICON_SIZE}" fill="${PWA_ICON_BACKGROUND}"/>`,
    );
    const { inner } = extractSvgInner(mascot);
    expect(svg).toContain(inner.slice(0, 40));
  });

  it("viewBox が無い SVG は拒否する", () => {
    expect(() => buildPwaIconSvg("<svg></svg>")).toThrow(/viewBox/);
  });
});

describe("buildPwaShortcutIconSvg", () => {
  it("クリーム地に primary の円と Plus を載せ、キャラは載せない", () => {
    const svg = buildPwaShortcutIconSvg();
    expect(svg).toContain(`viewBox="0 0 ${PWA_SHORTCUT_ICON_SIZE} ${PWA_SHORTCUT_ICON_SIZE}"`);
    expect(svg).toContain(`fill="${PWA_ICON_BACKGROUND}"`);
    expect(svg).toContain(`fill="${PWA_SHORTCUT_ICON_ACCENT}"`);
    expect(svg).toContain(`stroke="${PWA_SHORTCUT_ICON_GLYPH}"`);
    expect(svg).toContain('d="M5 12h14"');
    expect(svg).toContain('d="M12 5v14"');
    expect(svg).not.toContain("#8E2F3C");
  });

  it("円はマスク可能のセーフゾーン（内側 80%）に収まる", () => {
    const size = 100;
    const svg = buildPwaShortcutIconSvg(size);
    const radius = Number(svg.match(/<circle[^>]* r="([\d.]+)"/)?.[1]);
    expect(radius).toBeGreaterThan(0);
    expect(radius * 2).toBeLessThanOrEqual(size * 0.8);
  });
});
