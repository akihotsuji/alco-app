import { describe, expect, it } from "vitest";
import {
  generateAuthSecret,
  generateVapidKeys,
  hasAuthSecret,
  hasVapidKeys,
  upsertAuthSecret,
  upsertVapidKeys,
} from "./local-dev-vars.ts";

const EXAMPLE = `# comment
BETTER_AUTH_SECRET=
# BETTER_AUTH_URL=
RESEND_API_KEY=
`;

describe("local-dev-vars", () => {
  it("空の BETTER_AUTH_SECRET は未設定とみなす", () => {
    expect(hasAuthSecret("BETTER_AUTH_SECRET=\n")).toBe(false);
    expect(hasAuthSecret("BETTER_AUTH_SECRET=   \n")).toBe(false);
    expect(hasAuthSecret("BETTER_AUTH_SECRET=abc\n")).toBe(true);
  });

  it("既存に秘密があるときは上書きしない", () => {
    const existing = "BETTER_AUTH_SECRET=keep-me\nRESEND_API_KEY=\n";
    const result = upsertAuthSecret(existing, EXAMPLE, "new-secret");
    expect(result.wroteSecret).toBe(false);
    expect(result.content).toBe(existing);
  });

  it("無いときは example の空キーに秘密を入れる", () => {
    const result = upsertAuthSecret(null, EXAMPLE, "generated");
    expect(result.wroteSecret).toBe(true);
    expect(result.content).toMatch(/^BETTER_AUTH_SECRET=generated$/m);
    expect(result.content).toContain("RESEND_API_KEY=");
    expect(result.content).not.toMatch(/^BETTER_AUTH_SECRET=$/m);
  });

  it("生成値は 64 桁 hex で、関数は値をログしない", () => {
    const secret = generateAuthSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(generateAuthSecret()).not.toBe(secret);
  });

  it("VAPID 鍵は P-256 の公開鍵 65 バイトと秘密鍵 32 バイトの base64url で、毎回別の組になる", async () => {
    const keys = generateVapidKeys();
    const raw = Buffer.from(keys.publicKey, "base64url");
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    expect(Buffer.from(keys.privateKey, "base64url").length).toBe(32);
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateVapidKeys().privateKey).not.toBe(keys.privateKey);
    const signingKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        d: keys.privateKey,
        x: raw.subarray(1, 33).toString("base64url"),
        y: raw.subarray(33).toString("base64url"),
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    expect(signingKey.type).toBe("private");
  });

  it("VAPID 鍵が揃っていれば触らず、片方だけ・空なら両方を書き直す", () => {
    const keys = { publicKey: "PUB", privateKey: "PRIV" };
    const both = "BETTER_AUTH_SECRET=x\nVAPID_PUBLIC_KEY=a\nVAPID_PRIVATE_KEY=b\n";
    expect(hasVapidKeys(both)).toBe(true);
    expect(upsertVapidKeys(both, keys)).toEqual({ content: both, wroteKeys: false });

    const half = "BETTER_AUTH_SECRET=x\nVAPID_PUBLIC_KEY=a\nVAPID_PRIVATE_KEY=\n";
    const rewritten = upsertVapidKeys(half, keys);
    expect(rewritten.wroteKeys).toBe(true);
    expect(rewritten.content).toMatch(/^VAPID_PUBLIC_KEY=PUB$/m);
    expect(rewritten.content).toMatch(/^VAPID_PRIVATE_KEY=PRIV$/m);

    const appended = upsertVapidKeys("BETTER_AUTH_SECRET=x\n", keys).content;
    expect(appended).toBe("BETTER_AUTH_SECRET=x\nVAPID_PUBLIC_KEY=PUB\nVAPID_PRIVATE_KEY=PRIV\n");
  });
});
