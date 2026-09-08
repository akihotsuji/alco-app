import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "GuideSpotlight.tsx"), "utf8");
const host = readFileSync(join(here, "FirstRunGuideHost.tsx"), "utf8");
const home = readFileSync(join(here, "../../pages/HomePage.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");
const headers = readFileSync(join(here, "../../../../public/_headers"), "utf8");

describe("GuideSpotlight", () => {
  it("対象を切り抜くスポットライトと終了だけを持つ", () => {
    expect(source).toContain("guideSpotlight");
    expect(source).toContain("guide-spotlight");
    expect(source).toContain("guide-spotlight-ring");
    expect(source).toContain("data-practice");
    expect(source).toContain("queryPreferredGuideTarget");
    expect(source).toContain("visualViewport");
    expect(source).toContain("guideSpotlightPath");
    expect(source).toContain("MutationObserver");
    expect(css).toContain('[data-practice="1"]');
    expect(source).toContain("ガイドを終了");
    expect(source).toContain("guideStepProgress");
    expect(source).not.toContain("setTimeout");
    expect(host).toContain("GuideSpotlight");
    expect(host).not.toContain("GuideHomeSpotlight");
    expect(home).not.toContain("GuideHomeBanner");
    expect(home).not.toContain("GuideHomeSpotlight");
    expect(home).toContain('guide.step === "home-record"');
    expect(css).toContain("rgb(0 0 0 / 55%)");
    expect(css).toContain("z-index: 50");
    expect(css).toContain("--guide-tip-arrow-x");
    expect(css).toContain("min-inline-size: 0");
    expect(css).toContain("scroll-margin-top: 168px");
    expect(css).not.toMatch(/\[data-guide-target\][^{]*\{[^}]*position:\s*relative/);
    expect(css).not.toMatch(/\.guide-spotlight-panel[^{]*\{[^}]*var\(--foreground\)/);
  });

  it("対象が無いときは暗幕を出さない", () => {
    expect(source).toContain("!onExpectedPath || !hole");
  });
});

describe("現在地の Permissions-Policy", () => {
  it("SPA は self の geolocation を許可しマイクは閉じる", () => {
    expect(headers).toContain("geolocation=(self)");
    expect(headers).toContain("microphone=()");
    expect(headers).not.toMatch(/geolocation=\(\)/);
  });
});
