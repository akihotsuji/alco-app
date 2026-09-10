import { describe, expect, it } from "vitest";
import { user } from "@/db/schema.ts";
import { SIGNUPS_CLOSED_MESSAGE } from "@/shared/auth.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import { createTestApp, signIn, signInSocial, signUp } from "./test-helpers.ts";

const TEST_GOOGLE = {
  clientId: "test-google-client.apps.googleusercontent.com",
  clientSecret: "test-google-client-secret",
};

describe("SIGNUPS_CLOSED", () => {
  it("未設定では従来どおり登録できる", async () => {
    const { app, db } = await createTestApp();
    const res = await signUp(app, {
      name: "開",
      email: "open-signup@example.com",
      password: "password1",
    });
    expect(res.status).toBe(200);
    expect(await db.select({ email: user.email }).from(user)).toEqual([
      { email: "open-signup@example.com" },
    ]);
  });

  it("閉じているとメール登録は 400 でユーザーを作らない", async () => {
    const { app, db } = await createTestApp({ signupsClosed: true });
    const res = await signUp(app, {
      name: "閉",
      email: "closed-signup@example.com",
      password: "password1",
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain(SIGNUPS_CLOSED_MESSAGE);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);
  });

  it("閉じていると Google 新規は 400。requestSignUp なしは登録停止文にしない", async () => {
    const { app, db } = await createTestApp({
      signupsClosed: true,
      google: TEST_GOOGLE,
    });
    const signup = await signInSocial(app, {
      provider: "google",
      callbackURL: "/",
      newUserCallbackURL: "/age",
      errorCallbackURL: "/signup",
      disableRedirect: true,
      requestSignUp: true,
      additionalData: { acceptedLegal: true, legalVersion: LEGAL_VERSION },
    });
    expect(signup.status).toBe(400);
    expect(JSON.stringify(await signup.json())).toContain(SIGNUPS_CLOSED_MESSAGE);
    expect(await db.select({ email: user.email }).from(user)).toEqual([]);

    const loginStart = await signInSocial(app, {
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/login",
      disableRedirect: true,
    });
    expect(loginStart.status).toBe(200);
    const payload = (await loginStart.json()) as { url?: string };
    expect(payload.url).toBeTypeOf("string");
    expect(JSON.stringify(payload)).not.toContain(SIGNUPS_CLOSED_MESSAGE);
  });

  it("停止中も既存ユーザーのメールログインは通る", async () => {
    const { app, setSignupsClosed } = await createTestApp();
    const email = "existing-login@example.com";
    const password = "password1";
    const created = await signUp(app, { name: "既存", email, password });
    expect(created.status).toBe(200);

    setSignupsClosed(true);
    const login = await signIn(app, { email, password });
    expect(login.status).toBe(200);
    expect(JSON.stringify(await login.json())).not.toContain(SIGNUPS_CLOSED_MESSAGE);

    const blocked = await signUp(app, {
      name: "後から",
      email: "later-signup@example.com",
      password,
    });
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(await blocked.json())).toContain(SIGNUPS_CLOSED_MESSAGE);
  });

  it("停止中も未認証の業務 API は 401", async () => {
    const { app } = await createTestApp({ signupsClosed: true });
    const res = await app.request("/api/drink-logs?date=2026-09-10");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
