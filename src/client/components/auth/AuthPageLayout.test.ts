import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "AuthPageLayout.tsx"),
  "utf8",
);

describe("AuthPageLayout L2", () => {
  it("ワードマークは公開名称で、仮名 alco-app を出さない", () => {
    expect(source).toContain("PWA_NAME");
    expect(source).toContain('pose="default"');
    expect(source).toContain("size={120}");
    expect(source).not.toContain("alco-app");
  });
});
