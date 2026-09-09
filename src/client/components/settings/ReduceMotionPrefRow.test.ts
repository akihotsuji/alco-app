import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "ReduceMotionPrefRow.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("ReduceMotionPrefRow", () => {
  it("native radio のまま、ポインタではフォーカスせず visually-hidden も使わない", () => {
    expect(source).toContain('type="radio"');
    expect(source).toContain('name="reduce-motion"');
    expect(source).toContain("preventPointerFocus");
    expect(source).toContain("onMouseDown={preventPointerFocus}");
    expect(source).toContain("settings-segment-radio");
    expect(source).toContain("blur()");
    expect(source).not.toContain("visually-hidden");
    const option = css.slice(css.indexOf(".settings-segment-option {"));
    expect(option.startsWith(".settings-segment-option {\n  position: relative;")).toBe(true);
    expect(css).toContain(".settings-segment-radio");
    expect(css).toContain("overflow-anchor: none");
  });
});
