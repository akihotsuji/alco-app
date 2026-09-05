import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cookieHeaderFrom, createTestApp, signIn, signUp } from "./test-helpers.ts";

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

  it("ユーザーAの Cookie ではユーザーBの me が返らない", async () => {
    const { app } = await createTestApp();
    const aRes = await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });
    const bRes = await signUp(app, {
      name: "B",
      email: "b@example.com",
      password: "password1",
    });
    expect(aRes.status).toBe(200);
    expect(bRes.status).toBe(200);

    const meA = meSchema.parse(
      await (await app.request("/api/me", { headers: { Cookie: cookieHeaderFrom(aRes) } })).json(),
    );
    const meB = meSchema.parse(
      await (await app.request("/api/me", { headers: { Cookie: cookieHeaderFrom(bRes) } })).json(),
    );

    expect(meA).toMatchObject({ email: "a@example.com", name: "A" });
    expect(meB).toMatchObject({ email: "b@example.com", name: "B" });
    expect(meA.id).not.toBe(meB.id);
  });

  it("誤ったパスワードではログインできず、存在推測できる本文を出さない", async () => {
    const { app } = await createTestApp();
    await signUp(app, {
      name: "A",
      email: "a@example.com",
      password: "password1",
    });
    const res = await signIn(app, {
      email: "a@example.com",
      password: "wrong-password",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/password1/);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("stack");
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
