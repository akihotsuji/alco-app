import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../..");

const INVENTORY_KEYS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ALERT_WEBHOOK_URL",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "RESEND_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TURNSTILE_SECRET_KEY",
] as const;

const SKIP_SUFFIX = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".wasm",
  ".onnx",
  ".woff",
  ".woff2",
  ".ico",
];

function gitLsFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot });
  return out.toString("utf8").split("\0").filter(Boolean);
}

function readTracked(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assignmentValue(line: string, key: string): string | undefined {
  const match = line.match(new RegExp(`${key}\\s*[=:]\\s*(.*)$`));
  const raw = match?.[1];
  if (raw === undefined) {
    return undefined;
  }
  return raw.trim().replace(/^["']|["']$/g, "");
}

function isPlaceholder(value: string): boolean {
  if (value === "" || value === "%s") {
    return true;
  }
  if (value.startsWith("${") || value.startsWith("$(") || value.startsWith("$CLOUDFLARE")) {
    return true;
  }
  return value.length < 20;
}

function looksLikeSecretValue(value: string): boolean {
  if (/^[0-9a-f]{32,}$/i.test(value)) {
    return true;
  }
  if (/^-----BEGIN /.test(value)) {
    return true;
  }
  return /^(sk_live_|sk_test_|ghp_|github_pat_|re_)/.test(value);
}

describe("secret inventory", () => {
  it("does not track .dev.vars or .env files", () => {
    const tracked = gitLsFiles();
    const leaked = tracked.filter(
      (file) =>
        /(^|\/)\.dev\.vars$/.test(file) ||
        /(^|\/)\.env$/.test(file) ||
        /(^|\/)\.env\.local$/.test(file),
    );
    expect(leaked).toEqual([]);
    expect(tracked).toContain(".dev.vars.example");
  });

  it("keeps .dev.vars.example as key names with empty local secrets", () => {
    const example = readTracked(".dev.vars.example");
    expect(example).toMatch(/^BETTER_AUTH_SECRET=$/m);
    expect(example).not.toMatch(/^BETTER_AUTH_SECRET=.+$/m);
    expect(example).toContain("ALERT_WEBHOOK_URL=");
    expect(example).not.toMatch(/^ALERT_WEBHOOK_URL=.+$/m);
    expect(example).toMatch(/^RESEND_API_KEY=$/m);
    expect(example).not.toMatch(/^RESEND_API_KEY=.+$/m);
    expect(example).toMatch(/^GOOGLE_CLIENT_ID=$/m);
    expect(example).not.toMatch(/^GOOGLE_CLIENT_ID=.+$/m);
    expect(example).toMatch(/^GOOGLE_CLIENT_SECRET=$/m);
    expect(example).not.toMatch(/^GOOGLE_CLIENT_SECRET=.+$/m);
    expect(example).toMatch(/^TURNSTILE_SITE_KEY=$/m);
    expect(example).not.toMatch(/^TURNSTILE_SITE_KEY=.+$/m);
    expect(example).toMatch(/^TURNSTILE_SECRET_KEY=$/m);
    expect(example).not.toMatch(/^TURNSTILE_SECRET_KEY=.+$/m);
    expect(example).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(example).not.toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("lists inventory keys in spec/secrets.md without assigned values", () => {
    const spec = readTracked("spec/secrets.md");
    for (const key of INVENTORY_KEYS) {
      expect(spec).toContain(key);
    }
    expect(spec).not.toMatch(/BETTER_AUTH_SECRET\s*=\s*[0-9a-fA-F]{16,}/);
    expect(spec).not.toMatch(/CLOUDFLARE_API_TOKEN\s*=\s*[A-Za-z0-9_-]{16,}/);
    expect(spec).not.toMatch(/ALERT_WEBHOOK_URL\s*=\s*https?:\/\//);
  });

  it("does not commit secret-looking assignments in tracked files", () => {
    const hits: string[] = [];
    for (const file of gitLsFiles()) {
      if (SKIP_SUFFIX.some((suffix) => file.endsWith(suffix))) {
        continue;
      }
      const source = readTracked(file);
      if (source.includes("\0")) {
        continue;
      }
      for (const [index, line] of source.split(/\r?\n/).entries()) {
        if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(line)) {
          hits.push(`${file}:${index + 1}`);
          continue;
        }
        for (const key of [
          "BETTER_AUTH_SECRET",
          "CLOUDFLARE_API_TOKEN",
          "RESEND_API_KEY",
          "GOOGLE_CLIENT_SECRET",
          "TURNSTILE_SECRET_KEY",
        ] as const) {
          const value = assignmentValue(line, key);
          if (value === undefined || isPlaceholder(value)) {
            continue;
          }
          if (looksLikeSecretValue(value)) {
            hits.push(`${file}:${index + 1}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
