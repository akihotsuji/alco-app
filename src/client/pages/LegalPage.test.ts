import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "LegalPage.tsx"), "utf8");

describe("LegalPage", () => {
  it("本文はテキストとして描画し HTML を埋め込まない", () => {
    expect(source).toContain("{block.text}");
    expect(source).toContain("{item}");
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("innerHTML");
  });
});
