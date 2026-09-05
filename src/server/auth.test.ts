import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cookieHeaderFrom,
  createTestApp,
  createTestUserPair,
  signIn,
  signUp,
} from "./test-helpers.ts";

const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

describe("認証 API", () => {
  it("未認証の GET /api/me は 401 で user を出さない", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("サインアップで httpOnly のセッション Cookie を付け、/api/me は自分の id を返す", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "ユーザーA",
      email: "a@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);

    const setCookies = signUpRes.headers.getSetCookie();
    expect(setCookies.some((cookie) => /session_token=/i.test(cookie))).toBe(true);
    expect(
      setCookies.some((cookie) => /session_token=/i.test(cookie) && /HttpOnly/i.test(cookie)),
    ).toBe(true);

    const cookie = cookieHeaderFrom(signUpRes);
    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    const me = meSchema.parse(await meRes.json());
    expect(me).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
      email: "a@example.com",
      name: "ユーザーA",
    });
  });

  it("サインアップしたユーザーがログインすると、その Cookie で自分の me を取得できる", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "ログイン確認",
      email: "login@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);

    const signInRes = await signIn(app, {
      email: "login@example.com",
      password: "password1",
    });
    expect(signInRes.status).toBe(200);

    const meRes = await app.request("/api/me", {
      headers: { Cookie: cookieHeaderFrom(signInRes) },
    });
    expect(meRes.status).toBe(200);
    expect(meSchema.parse(await meRes.json())).toMatchObject({
      email: "login@example.com",
      name: "ログイン確認",
    });
  });

  it("ユーザーAの Cookie でユーザーBの id を指定しても、A の me だけを返す", async () => {
    const { app } = await createTestApp();
    const [userA, userB] = await createTestUserPair(app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);

    const meRes = await app.request(`/api/me?userId=${encodeURIComponent(userB.id)}`, {
      headers: { Cookie: userA.cookie },
    });
    expect(meRes.status).toBe(200);
    expect(meSchema.parse(await meRes.json())).toEqual({
      id: userA.id,
      email: userA.email,
      name: userA.name,
    });
    expect(userA.id).not.toBe(userB.id);
  });

  it("ログイン失敗はメールの登録有無で応答を変えず、内部情報を出さない", async () => {
    const { app } = await createTestApp();
    await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });
    const existingUserRes = await signIn(app, {
      email: "a@example.com",
      password: "wrong-password",
    });
    const unknownUserRes = await signIn(app, {
      email: "unknown@example.com",
      password: "wrong-password",
    });

    expect(existingUserRes.status).toBeGreaterThanOrEqual(400);
    expect(unknownUserRes.status).toBe(existingUserRes.status);
    const existingUserBody = await existingUserRes.json();
    const unknownUserBody = await unknownUserRes.json();
    expect(unknownUserBody).toEqual(existingUserBody);

    const serializedBody = JSON.stringify(existingUserBody);
    expect(serializedBody).not.toMatch(/password1|wrong-password/);
    expect(serializedBody.toLowerCase()).not.toMatch(/stack|select|account\.password/);
  });

  it("未定義の /api/* も未認証なら 401（ルートの存在を漏らさない）", async () => {
    const { app } = await createTestApp();
    const res = await app.request("/api/not-a-real-route");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("認証済みの未定義 /api/* は共通形式の 404", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);
    const res = await app.request("/api/not-a-real-route", {
      headers: { Cookie: cookieHeaderFrom(signUpRes) },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("公開ルートは Cookie なしで通る（health 200 / auth は Better Auth が処理）", async () => {
    const { app } = await createTestApp();
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);

    const session = await app.request("/api/auth/get-session");
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
  });

  it("ログアウト後は GET /api/me が 401 になる", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });
    const cookie = cookieHeaderFrom(signUpRes);
    const signOutRes = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        Cookie: cookie,
      },
    });
    expect(signOutRes.status).toBe(200);

    const meRes = await app.request("/api/me", {
      headers: { Cookie: cookie },
    });
    expect(meRes.status).toBe(401);
  });
});
