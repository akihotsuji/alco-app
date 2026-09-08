import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "GuideFanMenu.tsx"),
  "utf8",
);

describe("GuideFanMenu", () => {
  it("記録・セラー・ノートを扇の角度で出す", () => {
    expect(source).toContain("GUIDE_TOURS");
    expect(source).toContain("-48");
    expect(source).toContain("48");
    expect(source).toContain("--fan-deg");
    expect(source).toContain('role="menu"');
  });
});
