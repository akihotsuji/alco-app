import { generateKeyPairSync, randomBytes } from "node:crypto";
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

export type VapidKeyPair = { publicKey: string; privateKey: string };

const VAPID_PUBLIC_LINE = /^VAPID_PUBLIC_KEY=(.*)$/m;
const VAPID_PRIVATE_LINE = /^VAPID_PRIVATE_KEY=(.*)$/m;

/** Web Push の VAPID 鍵（P-256）。公開鍵は非圧縮点 65 バイト、秘密鍵は d 32 バイトの base64url */
export function generateVapidKeys(): VapidKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  if (!pub.x || !pub.y || !priv.d) {
    throw new Error("VAPID key generation failed");
  }
  const raw = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pub.x, "base64url"),
    Buffer.from(pub.y, "base64url"),
  ]);
  return { publicKey: raw.toString("base64url"), privateKey: priv.d };
}

export function hasVapidKeys(content: string): boolean {
  return Boolean(
    content.match(VAPID_PUBLIC_LINE)?.[1]?.trim() && content.match(VAPID_PRIVATE_LINE)?.[1]?.trim(),
  );
}

function setLine(content: string, pattern: RegExp, line: string): string {
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const trimmed = content.replace(/\s*$/, "");
  return `${trimmed}${trimmed.length > 0 ? "\n" : ""}${line}\n`;
}

/** 2 つが揃っているときは触らない。片方だけ・空なら 1 組を作り直して両方を書く */
export function upsertVapidKeys(
  content: string,
  keys: VapidKeyPair,
): { content: string; wroteKeys: boolean } {
  if (hasVapidKeys(content)) {
    return { content, wroteKeys: false };
  }
  const withPublic = setLine(content, VAPID_PUBLIC_LINE, `VAPID_PUBLIC_KEY=${keys.publicKey}`);
  return {
    content: setLine(withPublic, VAPID_PRIVATE_LINE, `VAPID_PRIVATE_KEY=${keys.privateKey}`),
    wroteKeys: true,
  };
}

export function ensureLocalDevVars(repoRoot: string): {
  created: boolean;
  wroteVapidKeys: boolean;
  path: string;
} {
  const varsPath = path.join(repoRoot, LOCAL_DEV_VARS_FILE);
  const examplePath = path.join(repoRoot, LOCAL_DEV_VARS_EXAMPLE_FILE);
  const existing = existsSync(varsPath) ? readFileSync(varsPath, "utf8") : null;
  const example = readFileSync(examplePath, "utf8");
  const auth = upsertAuthSecret(existing, example, generateAuthSecret());
  const vapid = hasVapidKeys(auth.content)
    ? { content: auth.content, wroteKeys: false }
    : upsertVapidKeys(auth.content, generateVapidKeys());
  if (auth.wroteSecret || vapid.wroteKeys) {
    writeFileSync(varsPath, vapid.content, { encoding: "utf8", mode: 0o600 });
    chmodSync(varsPath, 0o600);
  }
  return { created: auth.wroteSecret, wroteVapidKeys: vapid.wroteKeys, path: varsPath };
}
