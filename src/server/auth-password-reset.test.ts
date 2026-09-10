import { describe, expect, it } from "vitest";
import {
  createTestApp,
  requestPasswordReset,
  resetPassword,
  resetTokenFromUrl,
  signIn,
  signUp,
} from "./test-helpers.ts";

function jsonBody(response: Response) {
  return response.json() as Promise<unknown>;
}

describe("パスワードリセット", () => {
  it("招待コードなしで登録できる", async () => {
    const { app } = await createTestApp();
    const res = await signUp(app, {
      name: "公開登録",
      email: "open@example.com",
      password: "password1",
    });
    expect(res.status).toBe(200);
    const body = JSON.stringify(await jsonBody(res));
    expect(body.toLowerCase()).not.toMatch(/invite/);
  });

  it("未登録メールと登録済みメールの要求は同じ応答で、未登録は送らない", async () => {
    const { app, mailbox } = await createTestApp();
    await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });

    const existing = await requestPasswordReset(app, "a@example.com");
    const unknown = await requestPasswordReset(app, "unknown@example.com");
    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(existing.status);
    expect(await jsonBody(unknown)).toEqual(await jsonBody(existing));
    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]?.email).toBe("a@example.com");
    expect(mailbox[0]?.resetUrl).toMatch(/^http:\/\/localhost\/api\/auth\/reset-password\//);
  });

  it("トークンで再設定すると旧パスワードは使えず、新パスワードで入れる", async () => {
    const { app, mailbox } = await createTestApp();
    await signUp(app, {
      name: "A",
      email: "reset@example.com",
      password: "password1",
    });
    const requestRes = await requestPasswordReset(app, "reset@example.com");
    expect(requestRes.status).toBe(200);
    const token = resetTokenFromUrl(mailbox[0]?.resetUrl ?? "");

    const resetRes = await resetPassword(app, {
      token,
      newPassword: "password2",
    });
    expect(resetRes.status).toBe(200);
    expect(JSON.stringify(await jsonBody(resetRes))).not.toContain(token);

    const oldSignIn = await signIn(app, {
      email: "reset@example.com",
      password: "password1",
    });
    expect(oldSignIn.status).toBeGreaterThanOrEqual(400);

    const newSignIn = await signIn(app, {
      email: "reset@example.com",
      password: "password2",
    });
    expect(newSignIn.status).toBe(200);
  });

  it("不正トークンと再利用トークンは失敗し、本文にトークンを出さない", async () => {
    const { app, mailbox } = await createTestApp();
    await signUp(app, {
      name: "A",
      email: "reuse@example.com",
      password: "password1",
    });
    await requestPasswordReset(app, "reuse@example.com");
    const token = resetTokenFromUrl(mailbox[0]?.resetUrl ?? "");

    const first = await resetPassword(app, { token, newPassword: "password2" });
    expect(first.status).toBe(200);

    const reused = await resetPassword(app, { token, newPassword: "password3" });
    const invalid = await resetPassword(app, {
      token: "not-a-real-token",
      newPassword: "password3",
    });
    expect(reused.status).toBeGreaterThanOrEqual(400);
    expect(invalid.status).toBe(reused.status);
    const reusedBody = JSON.stringify(await jsonBody(reused));
    const invalidBody = JSON.stringify(await jsonBody(invalid));
    expect(reusedBody).not.toContain(token);
    expect(invalidBody).not.toMatch(/password2|password3/);
  });
});
