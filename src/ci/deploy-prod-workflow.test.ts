import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../..");
const deployProd = readFileSync(path.join(repoRoot, ".github/workflows/deploy-prod.yml"), "utf8");
const deployDev = readFileSync(path.join(repoRoot, ".github/workflows/deploy-dev.yml"), "utf8");
const ci = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

function indexAfter(source: string, snippet: string): number {
  const index = source.indexOf(snippet);
  expect(index, `missing ${snippet}`).toBeGreaterThan(-1);
  return index;
}

describe("deploy-prod.yml", () => {
  it("deploys only from semver tags or main workflow_dispatch", () => {
    expect(deployProd).toMatch(/^name: Deploy prod$/m);
    expect(deployProd).toContain("workflow_dispatch:");
    expect(deployProd).toContain('"v[0-9]+.[0-9]+.[0-9]+"');
    expect(deployProd).toContain("github.ref == 'refs/heads/main'");
    expect(deployProd).toContain("environment: production");
    expect(deployProd).toContain("cancel-in-progress: false");
  });

  it("does not deploy from pull requests or main pushes", () => {
    expect(deployProd).not.toMatch(/pull_request_target/);
    expect(deployProd).not.toMatch(/^on:[\s\S]*?^\s+pull_request:/m);
    expect(deployProd).not.toMatch(/^on:[\s\S]*?^\s+branches:/m);
    expect(deployProd).not.toContain("workflow_run:");
  });

  it("requires CI success then migrates production D1 before env.production deploy", () => {
    const ciAt = indexAfter(deployProd, "src/ci/require-ci-success.ts");
    const buildAt = indexAfter(deployProd, "pnpm build");
    const migrateAt = indexAfter(
      deployProd,
      "wrangler d1 migrations apply alco-app-prod --remote --env production",
    );
    const deployAt = indexAfter(deployProd, "wrangler deploy --env production");
    expect(ciAt).toBeLessThan(buildAt);
    expect(buildAt).toBeLessThan(migrateAt);
    expect(migrateAt).toBeLessThan(deployAt);
    expect(deployProd).not.toMatch(/--env dev/);
    const deployLines = deployProd.split("\n").filter((line) => line.includes("wrangler deploy"));
    expect(deployLines.length).toBeGreaterThan(0);
    for (const line of deployLines) {
      expect(line).toContain("--env production");
    }
  });

  it("reads Cloudflare secrets by name and does not echo them", () => {
    expect(deployProd).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(deployProd).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(deployProd).not.toContain("secrets.BETTER_AUTH_SECRET");
    expect(deployProd).not.toMatch(/echo:.*CLOUDFLARE_/);
    expect(deployProd).not.toMatch(/echo "\$\{/);
    expect(deployProd).toContain("contents: read");
    expect(deployProd).toContain("actions: read");
  });

  it("redacts wrangler logs", () => {
    expect(deployProd).toContain("src/ci/redact-wrangler-log.ts");
    expect(deployProd).toContain("set -o pipefail");
  });
});

describe("other workflows stay off production", () => {
  it("keeps deploy-dev and CI away from env.production", () => {
    expect(deployDev).not.toMatch(/--env production/);
    expect(ci).not.toContain("wrangler deploy");
    expect(ci).not.toContain("CLOUDFLARE_API_TOKEN");
  });
});
