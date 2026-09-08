import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "GuideSpotlight.tsx"), "utf8");
const host = readFileSync(join(here, "FirstRunGuideHost.tsx"), "utf8");
const home = readFileSync(join(here, "../../pages/HomePage.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("GuideSpotlight", () => {
  it("対象を切り抜くスポットライトと終了だけを持つ", () => {
    expect(source).toContain("guideSpotlight");
    expect(source).toContain("guide-spotlight");
    expect(source).toContain("guide-spotlight-ring");
    expect(source).toContain("ガイドを終了");
    expect(source).toContain("guideStepProgress");
    expect(source).not.toContain("setTimeout");
    expect(host).toContain("GuideSpotlight");
    expect(host).not.toContain("GuideHomeSpotlight");
    expect(home).not.toContain("GuideHomeBanner");
    expect(home).not.toContain("GuideHomeSpotlight");
    expect(css).toContain("rgb(0 0 0 / 55%)");
    expect(css).toContain("z-index: 50");
    expect(css).not.toMatch(/\.guide-spotlight-panel[^{]*\{[^}]*var\(--foreground\)/);
  });
});
