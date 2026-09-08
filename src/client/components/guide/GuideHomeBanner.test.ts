import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "GuideHomeBanner.tsx"), "utf8");
const home = readFileSync(join(here, "../../pages/HomePage.tsx"), "utf8");

describe("GuideHomeBanner", () => {
  it("H8 直下の一文と終了だけを持つ", () => {
    expect(source).toContain("飲んだ量は、ここから残せます");
    expect(source).toContain("ガイドを終了");
    expect(source).not.toContain("setTimeout");
    expect(home).toContain("GuideHomeBanner");
  });
});
