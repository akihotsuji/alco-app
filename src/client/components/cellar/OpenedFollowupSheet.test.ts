import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "OpenedFollowupSheet.tsx"),
  "utf8",
);

describe("OpenedFollowupSheet T3b", () => {
  it("見出し・補足と3操作だけ出す", () => {
    expect(source).toContain("開栓しました");
    expect(source).toContain("このボトルについて残しますか？");
    expect(source).toContain("飲んだ量を記録");
    expect(source).toContain("テイスティングを書く");
    expect(source).toContain("今はしない");
    expect(source).not.toContain("あとで");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
