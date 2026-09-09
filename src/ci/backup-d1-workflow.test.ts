import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_BUCKET,
  REHEARSAL_DATABASE,
  REHEARSAL_TABLE_LIST_SQL,
  SCHEDULE_CRON_UTC,
} from "@/ci/d1-backup.ts";

const repoRoot = path.join(import.meta.dirname, "../..");
const backupD1 = readFileSync(path.join(repoRoot, ".github/workflows/backup-d1.yml"), "utf8");
const ci = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

describe("backup-d1.yml", () => {
  it("runs daily at 17:00 UTC and allows manual backup or rehearsal", () => {
    expect(backupD1).toMatch(/^name: Backup D1$/m);
    expect(backupD1).toContain(`cron: "${SCHEDULE_CRON_UTC}"`);
    expect(backupD1).toContain("workflow_dispatch:");
    expect(backupD1).toContain("default: both");
    expect(backupD1).toContain("default: backup");
    expect(backupD1).toContain("options: [backup, rehearse]");
    expect(backupD1).toContain("cancel-in-progress: false");
  });

  it("does not start from pull requests or upload SQL artifacts", () => {
    expect(backupD1).not.toMatch(/pull_request_target/);
    expect(backupD1).not.toMatch(/^on:[\s\S]*?^\s+pull_request:/m);
    expect(backupD1).not.toContain("upload-artifact");
    expect(backupD1).not.toContain("actions/upload-artifact");
    expect(backupD1).toContain("contents: read");
    expect(backupD1).not.toMatch(/contents:\s*write/);
  });

  it("exports remote D1 to the private backup bucket and never deploys", () => {
    expect(backupD1).toContain("wrangler d1 export");
    expect(backupD1).toContain("--remote");
    expect(backupD1).toContain("--skip-confirmation");
    expect(backupD1).toContain(`r2 object put "${BACKUP_BUCKET}/`);
    expect(backupD1).toContain("src/ci/d1-backup-lifecycle.json");
    expect(backupD1).not.toContain("wrangler deploy");
    expect(backupD1).not.toContain("alco-app-photos-dev");
    expect(backupD1).not.toContain("alco-app-photos-prod");
  });

  it("keeps restore import on the throwaway database only", () => {
    expect(backupD1).toContain(`assert-restore-target "${REHEARSAL_DATABASE}"`);
    expect(backupD1).toContain(`d1 execute "${REHEARSAL_DATABASE}"`);
    expect(backupD1).toContain(`d1 delete "${REHEARSAL_DATABASE}"`);
    expect(backupD1).toContain(REHEARSAL_TABLE_LIST_SQL);
    expect(backupD1).not.toContain("time-travel restore");
    expect(backupD1).not.toMatch(/d1 execute alco-app-prod/);
    expect(backupD1).not.toMatch(/d1 execute alco-app-dev/);
    expect(backupD1).not.toMatch(/d1 delete alco-app-prod/);
    expect(backupD1).not.toMatch(/d1 delete alco-app-dev/);
    expect(backupD1).not.toContain("--update-config");
    expect(backupD1).not.toContain("SELECT *");
  });

  it("redacts wrangler logs and prints only dump size and hash", () => {
    expect(backupD1).toContain("src/ci/d1-backup.ts");
    expect(backupD1).toMatch(/wrangler d1 export[\s\S]*?sanitize-log/);
    expect(backupD1).toMatch(/gzip -n -9[\s\S]*?summarize/);
    expect(backupD1).toContain("set -euo pipefail");
    expect(backupD1).not.toMatch(/echo:.*CLOUDFLARE_/);
    expect(backupD1).not.toMatch(/echo "\$\{/);
    expect(backupD1).not.toMatch(/\bcat\b/);
  });

  it("reads Cloudflare secrets by name and leaves CI verification-only", () => {
    expect(backupD1).toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(backupD1).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(backupD1).not.toContain("secrets.BETTER_AUTH_SECRET");
    expect(ci).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(ci).not.toContain("backup-d1");
    expect(ci).not.toContain("wrangler d1 export");
  });
});

describe("backup dumps stay out of git", () => {
  it("ignores local SQL dumps and the backups directory", () => {
    expect(gitignore).toContain("/backups/");
    expect(gitignore).toContain("*.sql.bak");
    expect(gitignore).toContain("/backup.sql");
  });
});
