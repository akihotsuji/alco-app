import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { legalConsents, user } from "@/db/schema.ts";
import { LEGAL_VERSION } from "@/shared/legal.ts";
import {
  cookieHeaderFrom,
  createTestApp,
  createTestUserPair,
  signIn,
  signUp,
  signUpWithBody,
  updateUserName,
} from "./test-helpers.ts";

const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  ageVerified: z.boolean(),
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
      ageVerified: false,
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
      ageVerified: true,
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

  it("未認証の表示名更新は 401", async () => {
    const { app } = await createTestApp();
    const res = await updateUserName(app, undefined, "新しい名前");
    expect(res.status).toBe(401);
  });

  it("表示名は自分のセッションだけ更新でき、他人の name は変わらない", async () => {
    const { app } = await createTestApp();
    const [userA, userB] = await createTestUserPair(app, [
      { name: "A", email: "a@example.com", password: "password1" },
      { name: "B", email: "b@example.com", password: "password1" },
    ]);

    const updateRes = await updateUserName(app, userA.cookie, "新しい名前");
    expect(updateRes.status).toBe(200);

    const meA = await app.request("/api/me", { headers: { Cookie: userA.cookie } });
    const meB = await app.request("/api/me", { headers: { Cookie: userB.cookie } });
    expect(meSchema.parse(await meA.json())).toMatchObject({
      id: userA.id,
      name: "新しい名前",
    });
    expect(meSchema.parse(await meB.json())).toMatchObject({
      id: userB.id,
      name: "B",
    });
  });

  it("空の表示名は未設定として保存できる", async () => {
    const { app } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "初期名",
      email: "empty-name@example.com",
      password: "password1",
    });
    const cookie = cookieHeaderFrom(signUpRes);
    const updateRes = await updateUserName(app, cookie, "");
    expect(updateRes.status).toBe(200);

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meSchema.parse(await meRes.json())).toMatchObject({
      email: "empty-name@example.com",
      name: "",
    });
  });

  it("同意なしのサインアップは 400 でユーザーを作らない", async () => {
    const { app, db } = await createTestApp();
    const res = await signUpWithBody(app, {
      name: "A",
      email: "no-legal@example.com",
      password: "password1",
    });
    expect(res.status).toBe(400);
    const users = await db.select({ email: user.email }).from(user);
    expect(users).toEqual([]);
  });

  it("旧版への同意は 400", async () => {
    const { app } = await createTestApp();
    const res = await signUpWithBody(app, {
      name: "A",
      email: "old-legal@example.com",
      password: "password1",
      acceptedLegal: true,
      legalVersion: "2010-01-01",
    });
    expect(res.status).toBe(400);
  });

  it("同意ありのサインアップは legal_consents に現行版を残す", async () => {
    const { app, db } = await createTestApp();
    const signUpRes = await signUp(app, {
      name: "同意",
      email: "legal@example.com",
      password: "password1",
    });
    expect(signUpRes.status).toBe(200);
    const me = meSchema.parse(
      await (
        await app.request("/api/me", { headers: { Cookie: cookieHeaderFrom(signUpRes) } })
      ).json(),
    );
    const rows = await db.select().from(legalConsents).where(eq(legalConsents.userId, me.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.documentVersion).toBe(LEGAL_VERSION);
    expect(rows[0]?.userId).toBe(me.id);
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
