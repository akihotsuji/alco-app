import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { meQueryOptions } from "@/client/hooks/use-me.ts";
import { ApiClientError, createApiClient } from "@/client/lib/api.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { session } from "@/db/schema.ts";
import { SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "@/shared/auth.ts";
import { cookieHeaderFrom, createTestApp, signUp } from "./test-helpers.ts";

const EXPIRES_IN_MS = SESSION_EXPIRES_IN_SECONDS * 1000;
const UPDATE_AGE_MS = SESSION_UPDATE_AGE_SECONDS * 1000;
const TIME_TOLERANCE_MS = 5_000;

type TestDb = Awaited<ReturnType<typeof createTestApp>>["db"];
type TestApp = Awaited<ReturnType<typeof createTestApp>>["app"];

function sessionCookieMaxAgeSeconds(setCookies: string[]): number | undefined {
  const cookie = setCookies.find((value) => /session_token=/i.test(value));
  if (!cookie) {
    return undefined;
  }
  const match = cookie.match(/Max-Age=(\d+)/i);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function expiresAtMs(row: { expiresAt: Date | number }): number {
  return row.expiresAt instanceof Date ? row.expiresAt.getTime() : Number(row.expiresAt);
}

async function loadSessions(db: TestDb) {
  return db.select().from(session);
}

async function setSessionExpiresAt(db: TestDb, sessionId: string, expiresAt: Date) {
  await db.update(session).set({ expiresAt }).where(eq(session.id, sessionId));
}

async function signUpSession(app: TestApp, email: string) {
  const signUpRes = await signUp(app, {
    name: "セッション確認",
    email,
    password: "password1",
  });
  expect(signUpRes.status).toBe(200);
  const cookie = cookieHeaderFrom(signUpRes);
  expect(cookie.length).toBeGreaterThan(0);
  return { signUpRes, cookie };
}

describe("セッション期限", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("新規ログイン時の DB と Cookie の期限は約 30 日", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { signUpRes } = await signUpSession(app, "new@example.com");

    const maxAge = sessionCookieMaxAgeSeconds(signUpRes.headers.getSetCookie());
    expect(maxAge).toBe(SESSION_EXPIRES_IN_SECONDS);

    const rows = await loadSessions(db);
    expect(rows).toHaveLength(1);
    expect(expiresAtMs(rows[0]!)).toBeGreaterThanOrEqual(loginAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(expiresAtMs(rows[0]!)).toBeLessThanOrEqual(loginAt + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("更新から 1 日未満の利用では有効期限を延長しない", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "fresh@example.com");
    const [created] = await loadSessions(db);
    expect(created).toBeDefined();
    const originalExpiresAt = expiresAtMs(created!);

    vi.setSystemTime(loginAt + UPDATE_AGE_MS - 1_000);
    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    expect(sessionCookieMaxAgeSeconds(meRes.headers.getSetCookie())).toBeUndefined();

    const getSessionRes = await app.request("/api/auth/get-session", {
      headers: { Cookie: cookie },
    });
    expect(getSessionRes.status).toBe(200);
    expect(await getSessionRes.json()).not.toBeNull();
    expect(sessionCookieMaxAgeSeconds(getSessionRes.headers.getSetCookie())).toBeUndefined();

    const [after] = await loadSessions(db);
    expect(expiresAtMs(after!)).toBe(originalExpiresAt);
  });

  it("更新から 1 日以上経過した有効セッションは、確認した時点から約 30 日後へ延長され Cookie も更新される", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "refresh@example.com");
    const [created] = await loadSessions(db);
    const originalExpiresAt = expiresAtMs(created!);

    const refreshAt = loginAt + UPDATE_AGE_MS + 1_000;
    vi.setSystemTime(refreshAt);
    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    expect(sessionCookieMaxAgeSeconds(meRes.headers.getSetCookie())).toBe(SESSION_EXPIRES_IN_SECONDS);
    expect(meRes.headers.getSetCookie().some((value) => /HttpOnly/i.test(value))).toBe(true);

    const [afterMe] = await loadSessions(db);
    const refreshedExpiresAt = expiresAtMs(afterMe!);
    expect(refreshedExpiresAt).not.toBe(originalExpiresAt);
    expect(refreshedExpiresAt).toBeGreaterThanOrEqual(refreshAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(refreshedExpiresAt).toBeLessThanOrEqual(refreshAt + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
    expect(refreshedExpiresAt).not.toBe(originalExpiresAt + UPDATE_AGE_MS);
  });

  it("ブラウザの GET /api/auth/get-session でも延長時に Set-Cookie が返る", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "get-session@example.com");

    const refreshAt = loginAt + UPDATE_AGE_MS + 1_000;
    vi.setSystemTime(refreshAt);
    const getSessionRes = await app.request("/api/auth/get-session", {
      headers: { Cookie: cookie },
    });
    expect(getSessionRes.status).toBe(200);
    expect(await getSessionRes.json()).not.toBeNull();
    expect(sessionCookieMaxAgeSeconds(getSessionRes.headers.getSetCookie())).toBe(
      SESSION_EXPIRES_IN_SECONDS,
    );

    const [after] = await loadSessions(db);
    expect(expiresAtMs(after!)).toBeGreaterThanOrEqual(refreshAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(expiresAtMs(after!)).toBeLessThanOrEqual(refreshAt + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("既存セッションは設定変更だけでは延びず、延長条件を満たす確認でその時点から 30 日になる", async () => {
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "legacy@example.com");
    const [created] = await loadSessions(db);
    expect(created).toBeDefined();
    const now = Date.now();
    const legacyExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    await setSessionExpiresAt(db, created!.id, legacyExpiresAt);

    const [before] = await loadSessions(db);
    expect(expiresAtMs(before!)).toBe(legacyExpiresAt.getTime());

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    expect(sessionCookieMaxAgeSeconds(meRes.headers.getSetCookie())).toBe(SESSION_EXPIRES_IN_SECONDS);

    const [after] = await loadSessions(db);
    const afterMs = expiresAtMs(after!);
    expect(afterMs).toBeGreaterThanOrEqual(now + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(afterMs).toBeLessThanOrEqual(Date.now() + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("更新されないまま期限切れになると保護 API は 401 で、延長して復活しない", async () => {
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "expired@example.com");
    const [created] = await loadSessions(db);
    expect(created).toBeDefined();
    await setSessionExpiresAt(db, created!.id, new Date(Date.now() - 1_000));

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(401);
    expect(await meRes.json()).toEqual({ error: "unauthorized" });

    const getSessionRes = await app.request("/api/auth/get-session", {
      headers: { Cookie: cookie },
    });
    expect(getSessionRes.status).toBe(200);
    expect(await getSessionRes.json()).toBeNull();

    const after = await loadSessions(db);
    expect(after.every((row) => expiresAtMs(row) <= Date.now())).toBe(true);

    const meAgain = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meAgain.status).toBe(401);
  });

  it("期限切れセッションの GET /api/me は 401 でクライアントの onUnauthorized を呼ぶ", async () => {
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "client-expired@example.com");
    const [created] = await loadSessions(db);
    expect(created).toBeDefined();
    await setSessionExpiresAt(db, created!.id, new Date(Date.now() - 1_000));

    const client = createApiClient({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set("Cookie", cookie);
        return app.request(input, { ...init, headers });
      },
    });
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });

    const error = await queryClient.fetchQuery(meQueryOptions(client)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("明示的なログアウト後は保護 API にアクセスできない", async () => {
    const { app } = await createTestApp();
    const { cookie } = await signUpSession(app, "logout@example.com");
    const signOutRes = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        Cookie: cookie,
      },
    });
    expect(signOutRes.status).toBe(200);

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(401);
    expect(await meRes.json()).toEqual({ error: "unauthorized" });
  });
});
