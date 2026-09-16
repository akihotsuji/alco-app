import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "CellarDestinationField.tsx"),
  "utf8",
);

describe("CellarDestinationField", () => {
  it("変更できるときだけボタンにし、個人セラーに共有説明を出さない", () => {
    expect(source).toContain("cellar-destination-label");
    expect(source).toContain("cellar-destination-card is-action");
    expect(source).toContain("保存先");
    expect(source).toContain("showChevron");
    expect(source).toContain("CELLAR_COPY.saveDestinationShared");
    expect(source).toContain("cellar-destination-shared-copy");
    expect(source).toContain("shared ? (");
    expect(source).toContain('<div className="cellar-destination-card">');
    expect(source).not.toContain("保存先：");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
