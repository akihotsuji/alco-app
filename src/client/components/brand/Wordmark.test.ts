import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PWA_NAME } from "@/shared/pwa.ts";
import {
  WORDMARK_GOLD,
  WORDMARK_INK,
  WORDMARK_VIEWBOX_HEIGHT,
  WORDMARK_VIEWBOX_WIDTH,
  WORDMARK_WIDTH_PX,
} from "./wordmark.ts";

const here = dirname(fileURLToPath(import.meta.url));
const specSvg = readFileSync(join(here, "../../../../spec/assets/brand/wordmark.svg"), "utf8");
const appSvg = readFileSync(join(here, "../../assets/brand/wordmark.svg"), "utf8");
const component = readFileSync(join(here, "Wordmark.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("Wordmark", () => {
  it("仕様正本とアプリ資産の SVG が同じ", () => {
    expect(appSvg).toBe(specSvg);
  });

  it("SVG は静的な2色パスだけで、スクリプトを含まない", () => {
    expect(specSvg).toContain(`viewBox="8 3 ${WORDMARK_VIEWBOX_WIDTH} ${WORDMARK_VIEWBOX_HEIGHT}"`);
    expect(specSvg).toContain(`fill="${WORDMARK_INK}"`);
    expect(specSvg).toContain(`fill="${WORDMARK_GOLD}"`);
    expect(specSvg).toContain(`aria-label="${PWA_NAME}"`);
    expect(specSvg).not.toMatch(/<script|foreignObject|onclick|javascript:/i);
  });

  it("img で公開名称を alt に出し、仮名 alco-app は出さない", () => {
    expect(component).toContain("auth-wordmark");
    expect(component).toContain("PWA_NAME");
    expect(component).toContain("wordmark.svg");
    expect(component).toContain("WORDMARK_WIDTH_PX");
    expect(component).not.toContain("alco-app");
    expect(component).not.toContain("dangerouslySetInnerHTML");
  });

  it("幅はトークン --wordmark-width と定数が一致する", () => {
    expect(css).toContain(`--wordmark-width: ${WORDMARK_WIDTH_PX}px`);
    expect(css).toContain("aspect-ratio: 1012 / 286");
  });
});
