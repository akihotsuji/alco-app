import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ORIGIN_CANDIDATE_LABEL, ORIGIN_FREQUENT_LABEL } from "./OriginCountryField.tsx";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "OriginCountryField.tsx"), "utf8");
const identity = readFileSync(join(here, "IdentityFields.tsx"), "utf8");

describe("OriginCountryField 写真からの候補（03-log.md N8b）", () => {
  it("候補は空欄のときだけ「よく使う国」の上に 1 チップで出し、タップは select（ユーザー入力扱い）", () => {
    expect(ORIGIN_CANDIDATE_LABEL).toBe("写真からの候補");
    expect(ORIGIN_FREQUENT_LABEL).toBe("よく使う国");
    expect(source).toContain(
      "const showCandidate = showFrequent && !aiPending && isAllowedOriginJa(candidateName)",
    );
    expect(source).toContain('<div className="origin-frequent origin-candidate">');
    expect(source).toContain("<Chip onSelect={() => select(candidateName)}>{candidateName}</Chip>");
    expect(source.indexOf("origin-candidate")).toBeLessThan(source.indexOf("{showFrequent ? ("));
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });

  it("IdentityFields は originCandidate を生産国欄だけに渡す", () => {
    expect(identity).toContain("originCandidate?: string | null;");
    expect(identity).toContain("candidate={originCandidate}");
  });
});
