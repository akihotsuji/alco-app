import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "GuideHomeSpotlight.tsx"), "utf8");
const host = readFileSync(join(here, "FirstRunGuideHost.tsx"), "utf8");
const home = readFileSync(join(here, "../../pages/HomePage.tsx"), "utf8");

describe("GuideHomeSpotlight", () => {
  it("H8 を切り抜くスポットライトと終了だけを持つ", () => {
    expect(source).toContain("data-guide-target");
    expect(source).toContain("guide-spotlight");
    expect(source).toContain("飲んだ量は、ここから残せます");
    expect(source).toContain("ガイドを終了");
    expect(source).toContain("guideStepProgress");
    expect(source).not.toContain("setTimeout");
    expect(host).toContain("GuideHomeSpotlight");
    expect(home).not.toContain("GuideHomeBanner");
    expect(home).not.toContain("GuideHomeSpotlight");
  });
});
