import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeRestoreTarget,
  BACKUP_BUCKET,
  BACKUP_TARGETS,
  buildObjectKey,
  formatBackupStamp,
  isProtectedDatabase,
  parseBackupSelection,
  pickRehearseSource,
  REHEARSAL_DATABASE,
  RETENTION_DAYS,
  RETENTION_MAX_AGE_SECONDS,
  SCHEDULE_CRON_UTC,
  sanitizeBackupLog,
  summarizeBackupFile,
} from "@/ci/d1-backup.ts";

const repoRoot = path.join(import.meta.dirname, "../..");

describe("d1 backup helpers", () => {
  it("defaults the daily selection to both production and dev", () => {
    expect(parseBackupSelection(undefined)).toEqual(["alco-app-prod", "alco-app-dev"]);
    expect(parseBackupSelection("")).toEqual(["alco-app-prod", "alco-app-dev"]);
    expect(parseBackupSelection("both")).toEqual(["alco-app-prod", "alco-app-dev"]);
    expect(parseBackupSelection("alco-app-prod")).toEqual(["alco-app-prod"]);
    expect(parseBackupSelection("alco-app-dev")).toEqual(["alco-app-dev"]);
    expect(() => parseBackupSelection("alco-app-d1-restore-rehearsal")).toThrow(/Unknown/);
  });

  it("prefers dev as the rehearsal export source so production is not blocked", () => {
    expect(pickRehearseSource("both")).toBe("alco-app-dev");
    expect(pickRehearseSource("alco-app-dev")).toBe("alco-app-dev");
    expect(pickRehearseSource("alco-app-prod")).toBe("alco-app-prod");
  });

  it("builds a dated R2 key without putting dumps in the photos buckets", () => {
    const at = new Date("2026-09-09T17:00:05.123Z");
    expect(formatBackupStamp(at)).toBe("2026-09-09T170005Z");
    expect(buildObjectKey("alco-app-prod", at)).toBe(
      "prod/alco-app-prod-2026-09-09T170005Z.sql.gz",
    );
    expect(buildObjectKey("alco-app-dev", at)).toBe("dev/alco-app-dev-2026-09-09T170005Z.sql.gz");
    expect(BACKUP_BUCKET).toBe("alco-app-d1-backups");
    expect(BACKUP_TARGETS["alco-app-prod"].wranglerEnv).toBe("production");
    expect(BACKUP_TARGETS["alco-app-dev"].wranglerEnv).toBe("dev");
  });

  it("keeps the lifecycle JSON at 14 days in seconds", () => {
    expect(RETENTION_DAYS).toBe(14);
    expect(RETENTION_MAX_AGE_SECONDS).toBe(1_209_600);
    expect(SCHEDULE_CRON_UTC).toBe("0 17 * * *");
    const lifecycle = JSON.parse(
      readFileSync(path.join(repoRoot, "src/ci/d1-backup-lifecycle.json"), "utf8"),
    ) as {
      rules: Array<{
        id: string;
        enabled: boolean;
        deleteObjectsTransition?: { condition?: { maxAge?: number; type?: string } };
      }>;
    };
    expect(lifecycle.rules).toHaveLength(1);
    expect(lifecycle.rules[0]?.id).toBe("expire-d1-backups-14d");
    expect(lifecycle.rules[0]?.enabled).toBe(true);
    expect(lifecycle.rules[0]?.deleteObjectsTransition?.condition?.type).toBe("Age");
    expect(lifecycle.rules[0]?.deleteObjectsTransition?.condition?.maxAge).toBe(
      RETENTION_MAX_AGE_SECONDS,
    );
  });

  it("rejects restore targets other than the throwaway rehearsal database", () => {
    expect(isProtectedDatabase("alco-app-prod")).toBe(true);
    expect(isProtectedDatabase("alco-app-dev")).toBe(true);
    expect(isProtectedDatabase(REHEARSAL_DATABASE)).toBe(false);
    expect(() => assertSafeRestoreTarget("alco-app-prod")).toThrow(/Restore target/);
    expect(() => assertSafeRestoreTarget("alco-app-dev")).toThrow(/Restore target/);
    expect(() => assertSafeRestoreTarget("users")).toThrow(/Restore target/);
    expect(() => assertSafeRestoreTarget(REHEARSAL_DATABASE)).not.toThrow();
  });

  it("strips SQL rows, emails, and every http(s) URL including export signed links", () => {
    const signed =
      "https://example.r2.cloudflarestorage.com/export.sql?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef";
    const input = [
      "Exported to backups/alco-app-prod.sql",
      "INSERT INTO user (email) VALUES ('owner@example.com');",
      "contact owner@example.com",
      "https://alco-app-prod.example.workers.dev",
      `You can also download your export from the following URL manually. This link will be valid for one hour: ${signed}`,
      `{"signed_url":"${signed}"}`,
    ].join("\n");
    const sanitized = sanitizeBackupLog(input);
    expect(sanitized).toBe(
      [
        "Exported to backups/alco-app-prod.sql",
        "[redacted-sql]",
        "contact [redacted-email]",
        "[redacted-url]",
        "You can also download your export from the following URL manually. This link will be valid for one hour: [redacted-url]",
        '{"signed_url":"[redacted-url]"}',
      ].join("\n"),
    );
    expect(sanitized).not.toMatch(/https?:\/\//i);
    expect(sanitized).not.toContain("X-Amz-Signature");
    expect(sanitized).not.toContain("cloudflarestorage.com");
  });

  it("summarizes a dump by size and hash without returning the file body", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "d1-backup-"));
    const filePath = path.join(dir, "dummy.sql.gz");
    const body = "CREATE TABLE IF NOT EXISTS rehearsal_probe (id TEXT);";
    writeFileSync(filePath, body);
    const summary = summarizeBackupFile(filePath);
    expect(summary.bytes).toBe(Buffer.byteLength(body));
    expect(summary.sha256).toBe(createHash("sha256").update(body).digest("hex"));
    expect(summary).not.toHaveProperty("content");
    expect(JSON.stringify(summary)).not.toContain("rehearsal_probe");
  });
});
