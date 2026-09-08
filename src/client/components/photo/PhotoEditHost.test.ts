import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const host = readFileSync(join(here, "PhotoEditHost.tsx"), "utf8");
const shell = readFileSync(join(here, "../layout/AppShell.tsx"), "utf8");

describe("PhotoEditHost", () => {
  it("開いているときだけ PhotoEdit を dynamic import する", () => {
    expect(host).toContain('import("@/client/components/photo/PhotoEdit.tsx")');
    expect(host).toContain("if (!open)");
    expect(host).toContain("return null");
    expect(shell).toContain("PhotoEditHost");
    expect(shell).not.toContain('from "@/client/components/photo/PhotoEdit.tsx"');
  });
});
