import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "SwUpdateHost.tsx"),
  "utf8",
);

describe("SwUpdateHost", () => {
  it("更新アクションは設定の最新化と同じ再読み込み経路", () => {
    expect(source).toContain("refreshAppToLatest");
    expect(source).toContain("BOOT_COPY.updateAvailable");
    expect(source).not.toContain('requestAppReload("user")');
  });
});
