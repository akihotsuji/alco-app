import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MASCOT_POSES } from "./Mascot.tsx";

const here = dirname(fileURLToPath(import.meta.url));
const component = readFileSync(join(here, "Mascot.tsx"), "utf8");
const assets = join(here, "../../../../spec/assets/character");

function pathDs(svg: string): string[] {
  return [...svg.matchAll(/\bd="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((d) => d !== undefined);
}

describe("Mascot", () => {
  it("4 ポーズを公開する", () => {
    expect(MASCOT_POSES).toEqual(["default", "surprised", "rest", "cheer"]);
  });

  it("各ポーズの SVG パスが仕様アセットと同一", () => {
    for (const pose of MASCOT_POSES) {
      const svg = readFileSync(join(assets, `mascot-${pose}.svg`), "utf8");
      for (const d of pathDs(svg)) {
        expect(component, `${pose} の path ${d}`).toContain(d);
      }
    }
  });

  it("clipPath を useId で一意化する", () => {
    expect(component).toContain("useId()");
    expect(component).toMatch(/clipPath=\{`url\(#\$\{clipId\}\)`\}/);
  });

  it("黒目がテーマ非依存の --mascot-ink である", () => {
    expect(component).toContain('fill="var(--mascot-ink)"');
    expect(component).not.toMatch(/<circle[^>]*fill="currentColor"/);
  });
});
