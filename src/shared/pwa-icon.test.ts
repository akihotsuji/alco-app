import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PWA_ICON_BACKGROUND, PWA_ICON_LINE, PWA_ICON_SIZE } from "./pwa.ts";
import { buildPwaIconSvg, extractSvgInner } from "./pwa-icon.ts";

const mascot = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../spec/assets/character/mascot-default.svg"),
  "utf8",
);

describe("buildPwaIconSvg", () => {
  it("通常ポーズを primary 正方形に載せる", () => {
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
