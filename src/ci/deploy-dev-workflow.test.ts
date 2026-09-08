import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../..");
const deployDev = readFileSync(path.join(repoRoot, ".github/workflows/deploy-dev.yml"), "utf8");
const ci = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

function indexAfter(source: string, snippet: string): number {
  const index = source.indexOf(snippet);
  expect(index, `missing ${snippet}`).toBeGreaterThan(-1);
  return index;
}

describe("deploy-dev.yml", () => {
  it("is named Deploy dev and listens for CI success on main", () => {
    expect(deployDev).toMatch(/^name: Deploy dev$/m);
    expect(deployDev).toContain('workflows: ["CI"]');
    expect(deployDev).toContain("branches:");
    expect(deployDev).toContain("- main");
    expect(deployDev).toContain("workflow_dispatch:");
  });

  it("does not deploy from pull requests", () => {
    expect(deployDev).not.toMatch(/pull_request_target/);
    expect(deployDev).not.toMatch(/^on:[\s\S]*?^\s+pull_request:/m);
    expect(deployDev).toContain("github.event.workflow_run.event == 'push'");
    expect(deployDev).toContain("github.event.workflow_run.conclusion == 'success'");
  });

  it("builds and migrates remote D1 before deploying env.dev only", () => {
    const buildAt = indexAfter(deployDev, "pnpm build");
    const migrateAt = indexAfter(
      deployDev,
      "wrangler d1 migrations apply alco-app-dev --remote --env dev",
    );
    const deployAt = indexAfter(deployDev, "wrangler deploy --env dev");
    expect(buildAt).toBeLessThan(migrateAt);
    expect(migrateAt).toBeLessThan(deployAt);
    expect(deployDev).not.toMatch(/--env production/);
    const deployLines = deployDev.split("\n").filter((line) => line.includes("wrangler deploy"));
    expect(deployLines.length).toBeGreaterThan(0);
    for (const line of deployLines) {
      expect(line).toContain("--env dev");
    }
  });

  it("reads Cloudflare secrets by name and does not echo them", () => {
    expect(deployDev).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(deployDev).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(deployDev).not.toMatch(/echo:.*CLOUDFLARE_/);
    expect(deployDev).not.toMatch(/echo "\$\{/);
    expect(deployDev).toContain("contents: read");
  });

  it("redacts wrangler logs", () => {
    expect(deployDev).toContain("src/ci/redact-wrangler-log.ts");
    expect(deployDev).toContain("set -o pipefail");
  });
});

describe("ci.yml", () => {
  it("stays verification-only", () => {
    expect(ci).toMatch(/^name: CI$/m);
    expect(ci).not.toContain("wrangler deploy");
    expect(ci).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(ci).not.toContain("CLOUDFLARE_ACCOUNT_ID");
    expect(ci).not.toMatch(/pull_request_target/);
  });

  it("runs Playwright Chromium without production secrets", () => {
    expect(ci).toMatch(/^\s+e2e:/m);
    expect(ci).toContain("playwright install --with-deps chromium");
    expect(ci).toContain("pnpm test:e2e");
    expect(ci).toContain("openssl rand -hex 32");
    expect(ci).toContain("retention-days: 3");
    expect(ci).not.toContain("secrets.BETTER_AUTH_SECRET");
  });
});
