import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "ContentPhoto.tsx"), "utf8");

describe("ContentPhoto", () => {
  it("既定は lazy と async decode で、寸法を属性に出す", () => {
    expect(source).toContain('loading = "lazy"');
    expect(source).toContain('decoding="async"');
    expect(source).toContain("width={size.width}");
    expect(source).toContain("height={size.height}");
    expect(source).toContain("logRow: { width: 48, height: 48 }");
    expect(source).toContain("bottleTile: { width: 100, height: 150 }");
  });
});
