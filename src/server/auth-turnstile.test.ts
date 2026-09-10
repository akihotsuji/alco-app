import { describe, expect, it, vi } from "vitest";
import { user } from "@/db/schema.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import { TURNSTILE_TOKEN_HEADER } from "@/shared/turnstile.ts";
import {
  createTestApp,
  requestPasswordReset,
  signIn,
  signInSocial,
  signUp,
  signUpWithBody,
} from "./test-helpers.ts";

describe("Turnstile（認証）", () => {
  it("検証が有効なときトークン無しのサインアップは失敗しユーザーを作らない", async () => {
    const verifyTurnstile = vi.fn(async ({ token }: { token: string }) => token === "ok-token");
    const { app, db } = await createTestApp({ verifyTurnstile });

    const rejected = await signUp(app, {
      name: "A",
      email: "no-token@example.com",
      password: "password1",
    });
    expect(rejected.status).toBe(400);
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "",
      remoteIp: expect.stringMatching(/^10\.0\./),
    });
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("検証成功のトークン付きなら登録できる", async () => {
    const verifyTurnstile = vi.fn(async ({ token }: { token: string }) => token === "ok-token");
    const { app, db } = await createTestApp({ verifyTurnstile });

    const accepted = await signUpWithBody(
      app,
      {
        name: "A",
        email: "with-token@example.com",
        password: "password1",
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      },
      { [TURNSTILE_TOKEN_HEADER]: "ok-token" },
    );
    expect(accepted.status).toBe(200);
    expect(await db.select({ email: user.email }).from(user)).toEqual([
      { email: "with-token@example.com" },
    ]);
  });

  it("クライアント成功を信じず、検証失敗なら登録しない", async () => {
    const verifyTurnstile = vi.fn(async () => false);
    const { app, db } = await createTestApp({ verifyTurnstile });

    const rejected = await signUpWithBody(
      app,
      {
        name: "A",
        email: "fake-ok@example.com",
        password: "password1",
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      },
      { [TURNSTILE_TOKEN_HEADER]: "client-said-ok" },
    );
    expect(rejected.status).toBe(400);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("ログインと再設定要求もトークン無しは失敗する", async () => {
    const verifyTurnstile = vi.fn(async ({ token }: { token: string }) => token === "ok-token");
    const { app } = await createTestApp({ verifyTurnstile });
    const created = await signUpWithBody(
      app,
      {
        name: "A",
        email: "login-token@example.com",
        password: "password1",
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      },
      { [TURNSTILE_TOKEN_HEADER]: "ok-token" },
    );
    expect(created.status).toBe(200);

    const signInRes = await signIn(app, {
      email: "login-token@example.com",
      password: "password1",
    });
    expect(signInRes.status).toBe(400);

    const resetRes = await requestPasswordReset(app, "login-token@example.com");
    expect(resetRes.status).toBe(400);
  });

  it("Google 開始もトークン無しは失敗する", async () => {
    const verifyTurnstile = vi.fn(async ({ token }: { token: string }) => token === "ok-token");
    const { app } = await createTestApp({
      verifyTurnstile,
      google: {
        clientId: "test-google-client.apps.googleusercontent.com",
        clientSecret: "test-google-client-secret",
      },
    });

    const rejected = await signInSocial(app, {
      provider: "google",
      callbackURL: "/",
    });
    expect(rejected.status).toBe(400);
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "",
      remoteIp: expect.stringMatching(/^10\.0\./),
    });
  });
});
