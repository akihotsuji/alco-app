import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "./legal.ts";
import { PRIVACY_DOCUMENT, TERMS_DOCUMENT } from "./legal-documents.ts";

function allTexts(document: typeof TERMS_DOCUMENT): string[] {
  return document.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === "p" ? [block.text] : block.items)),
  );
}

describe("法務文書", () => {
  it("版が現行と一致し、酒類と国外移転を含む", () => {
    expect(TERMS_DOCUMENT.version).toBe(LEGAL_VERSION);
    expect(PRIVACY_DOCUMENT.version).toBe(LEGAL_VERSION);
    const terms = allTexts(TERMS_DOCUMENT).join("\n");
    const privacy = allTexts(PRIVACY_DOCUMENT).join("\n");
    expect(terms).toContain("満20歳未満");
    expect(terms).toContain("飲酒を推奨しません");
    expect(privacy).toContain("Cloudflare");
    expect(privacy).toContain("生活記録");
    expect(terms).not.toContain("もう一杯");
    expect(privacy).not.toContain("<script");
  });
});
