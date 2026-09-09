import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_API_ROUTES } from "@/server/middleware/auth.ts";

const repoRoot = path.join(import.meta.dirname, "../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("7-07 リリースゲート", () => {
  it("公開 API は GET /api/health と /api/auth/ だけ", () => {
    expect(PUBLIC_API_ROUTES).toEqual([
      { method: "GET", path: "/api/health" },
      { method: "*", prefix: "/api/auth/" },
    ]);
  });

  it("PR / Preview からの Workers デプロイが無い", () => {
    const deployProd = readRepo(".github/workflows/deploy-prod.yml");
    const deployDev = readRepo(".github/workflows/deploy-dev.yml");
    const ci = readRepo(".github/workflows/ci.yml");
    for (const source of [deployProd, deployDev, ci]) {
      expect(source).not.toMatch(/pull_request_target/);
      expect(source).not.toContain("wrangler versions upload");
      expect(source).not.toContain("preview_urls");
    }
    expect(deployProd).not.toMatch(/^on:[\s\S]*?^\s+pull_request:/m);
    expect(deployDev).not.toMatch(/^on:[\s\S]*?^\s+pull_request:/m);
  });

  it("写真 R2 は binding と bucket_name だけ（公開ドメイン設定を置かない）", () => {
    const wrangler = readRepo("wrangler.jsonc");
    expect(wrangler).not.toMatch(/r2\.dev/);
    expect(wrangler).not.toMatch(/public_access/i);
    expect(wrangler).not.toContain("alco-app-d1-backups");

    const r2Blocks = [...wrangler.matchAll(/"r2_buckets"\s*:\s*\[([\s\S]*?)\]/g)];
    expect(r2Blocks).toHaveLength(2);
    for (const match of r2Blocks) {
      const keys = [...(match[1] ?? "").matchAll(/"([a-z_]+)"\s*:/g)].map((item) => item[1]);
      expect(keys.sort()).toEqual(["binding", "bucket_name"]);
    }
  });
});
