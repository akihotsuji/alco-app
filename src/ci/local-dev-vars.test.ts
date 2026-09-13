import { describe, expect, it } from "vitest";
import { generateAuthSecret, hasAuthSecret, upsertAuthSecret } from "./local-dev-vars.ts";

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
});
