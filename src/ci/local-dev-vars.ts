import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const LOCAL_DEV_VARS_FILE = ".dev.vars";
export const LOCAL_DEV_VARS_EXAMPLE_FILE = ".dev.vars.example";
const AUTH_SECRET_LINE = /^BETTER_AUTH_SECRET=(.*)$/m;

export function hasAuthSecret(content: string): boolean {
  const match = content.match(AUTH_SECRET_LINE);
  return Boolean(match?.[1]?.trim());
}

export function generateAuthSecret(): string {
  return randomBytes(32).toString("hex");
}

/** 既存に秘密があるときは触らない。無いときだけ example を土台に BETTER_AUTH_SECRET を入れる。 */
export function upsertAuthSecret(
  existing: string | null,
  example: string,
  secret: string,
): { content: string; wroteSecret: boolean } {
  if (existing && hasAuthSecret(existing)) {
    return { content: existing, wroteSecret: false };
  }
  const base = existing ?? example;
  const nextLine = `BETTER_AUTH_SECRET=${secret}`;
  if (AUTH_SECRET_LINE.test(base)) {
    return { content: base.replace(AUTH_SECRET_LINE, nextLine), wroteSecret: true };
  }
  const trimmed = base.replace(/\s*$/, "");
  return {
    content: `${trimmed}${trimmed.length > 0 ? "\n" : ""}${nextLine}\n`,
    wroteSecret: true,
  };
}

export function ensureLocalDevVars(repoRoot: string): { created: boolean; path: string } {
  const varsPath = path.join(repoRoot, LOCAL_DEV_VARS_FILE);
  const examplePath = path.join(repoRoot, LOCAL_DEV_VARS_EXAMPLE_FILE);
  const existing = existsSync(varsPath) ? readFileSync(varsPath, "utf8") : null;
  const example = readFileSync(examplePath, "utf8");
  const { content, wroteSecret } = upsertAuthSecret(existing, example, generateAuthSecret());
  if (wroteSecret) {
    writeFileSync(varsPath, content, { encoding: "utf8", mode: 0o600 });
    chmodSync(varsPath, 0o600);
  }
  return { created: wroteSecret, path: varsPath };
}
