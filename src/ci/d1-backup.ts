import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { stderr, stdin, stdout } from "node:process";
import { redactWranglerLog } from "./redact-wrangler-log.ts";

export const BACKUP_BUCKET = "alco-app-d1-backups";
export const RETENTION_DAYS = 14;
export const RETENTION_MAX_AGE_SECONDS = RETENTION_DAYS * 86_400;
export const SCHEDULE_CRON_UTC = "0 17 * * *";
export const REHEARSAL_DATABASE = "alco-app-d1-restore-rehearsal";
export const REHEARSAL_TABLE_LIST_SQL =
  "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;";

export const BACKUP_TARGETS = {
  "alco-app-prod": { wranglerEnv: "production", prefix: "prod" },
  "alco-app-dev": { wranglerEnv: "dev", prefix: "dev" },
} as const;

export type BackupDatabase = keyof typeof BACKUP_TARGETS;

export const PROTECTED_DATABASES = ["alco-app-prod", "alco-app-dev"] as const;

const SQL_LINE = /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE TABLE|ALTER TABLE)\b/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** wrangler d1 export は約1時間有効の presigned URL を stdout に出す。public Actions ログに残さない */
const HTTP_URL = /https?:\/\/[^\s<>"'`]+/gi;

export function parseBackupSelection(input: string | undefined): BackupDatabase[] {
  const value = (input ?? "both").trim();
  if (value === "" || value === "both") {
    return ["alco-app-prod", "alco-app-dev"];
  }
  if (value === "alco-app-prod" || value === "alco-app-dev") {
    return [value];
  }
  throw new Error(`Unknown backup database: ${value}`);
}

export function pickRehearseSource(input: string | undefined): BackupDatabase {
  const selected = parseBackupSelection(input);
  if (selected.includes("alco-app-dev")) {
    return "alco-app-dev";
  }
  const only = selected[0];
  if (!only) {
    throw new Error("No rehearsal source");
  }
  return only;
}

export function formatBackupStamp(at: Date): string {
  const iso = at.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

export function buildObjectKey(database: BackupDatabase, at: Date): string {
  const target = BACKUP_TARGETS[database];
  return `${target.prefix}/${database}-${formatBackupStamp(at)}.sql.gz`;
}

export function isProtectedDatabase(name: string): boolean {
  return (PROTECTED_DATABASES as readonly string[]).includes(name);
}

export function assertSafeRestoreTarget(name: string): void {
  if (name !== REHEARSAL_DATABASE) {
    throw new Error(`Restore target must be ${REHEARSAL_DATABASE}`);
  }
}

export function sanitizeBackupLog(input: string): string {
  return redactWranglerLog(input)
    .split(/\r?\n/)
    .map((line) => {
      if (SQL_LINE.test(line)) {
        return "[redacted-sql]";
      }
      return line.replace(HTTP_URL, "[redacted-url]").replace(EMAIL, "[redacted-email]");
    })
    .join("\n");
}

export function summarizeBackupFile(filePath: string): { bytes: number; sha256: string } {
  const bytes = statSync(filePath).size;
  const sha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  return { bytes, sha256 };
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

const isCli = process.argv[1] !== undefined && import.meta.filename === process.argv[1];

if (isCli) {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case "databases": {
        for (const database of parseBackupSelection(args[0])) {
          stdout.write(`${database} ${BACKUP_TARGETS[database].wranglerEnv}\n`);
        }
        break;
      }
      case "rehearse-source": {
        const database = pickRehearseSource(args[0]);
        stdout.write(`${database} ${BACKUP_TARGETS[database].wranglerEnv}\n`);
        break;
      }
      case "object-key": {
        const database = readFlag(args, "--database");
        if (database !== "alco-app-prod" && database !== "alco-app-dev") {
          fail("object-key requires --database alco-app-prod|alco-app-dev");
        }
        const atRaw = readFlag(args, "--at");
        const at = atRaw ? new Date(atRaw) : new Date();
        if (Number.isNaN(at.getTime())) {
          fail("object-key --at must be an ISO timestamp");
        }
        stdout.write(`${buildObjectKey(database, at)}\n`);
        break;
      }
      case "summarize": {
        const filePath = args[0];
        if (!filePath) {
          fail("summarize requires a file path");
        }
        const summary = summarizeBackupFile(filePath);
        stdout.write(`backup bytes=${summary.bytes} sha256=${summary.sha256}\n`);
        break;
      }
      case "assert-restore-target": {
        const name = args[0];
        if (!name) {
          fail("assert-restore-target requires a database name");
        }
        assertSafeRestoreTarget(name);
        stdout.write(`restore target ok: ${name}\n`);
        break;
      }
      case "sanitize-log": {
        const chunks: string[] = [];
        stdin.setEncoding("utf8");
        stdin.on("data", (chunk) => {
          chunks.push(String(chunk));
        });
        stdin.on("end", () => {
          stdout.write(sanitizeBackupLog(chunks.join("")));
        });
        break;
      }
      default:
        fail(
          "Usage: d1-backup.ts databases|rehearse-source|object-key|summarize|assert-restore-target|sanitize-log",
        );
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "d1-backup failed");
  }
}
