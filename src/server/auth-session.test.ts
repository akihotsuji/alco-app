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

/** Cookie キャッシュ（`session_data`）を外し、DB を必ず見る経路にする。キャッシュ失効後のブラウザと同じ */
function withoutSessionDataCookie(cookie: string): string {
  return cookie
    .split("; ")
    .filter((part) => !/session_data/i.test(part))
    .join("; ");
}

type TestDb = Awaited<ReturnType<typeof createTestApp>>["db"];
type TestApp = Awaited<ReturnType<typeof createTestApp>>["app"];
type SessionRow = Awaited<ReturnType<typeof loadSessions>>[number];

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

async function loadSoleSession(db: TestDb): Promise<SessionRow> {
  const rows = await loadSessions(db);
  const row = rows[0];
  if (row === undefined || rows.length !== 1) {
    throw new Error("セッションはちょうど 1 件である必要があります");
  }
  return row;
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

    const created = await loadSoleSession(db);
    expect(expiresAtMs(created)).toBeGreaterThanOrEqual(
      loginAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS,
    );
    expect(expiresAtMs(created)).toBeLessThanOrEqual(loginAt + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("更新から 1 日未満の利用では有効期限を延長しない", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "fresh@example.com");
    const originalExpiresAt = expiresAtMs(await loadSoleSession(db));

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

    expect(expiresAtMs(await loadSoleSession(db))).toBe(originalExpiresAt);
  });

  it("更新から 1 日以上経過した有効セッションは、確認した時点から約 30 日後へ延長され Cookie も更新される", async () => {
    const loginAt = Date.parse("2026-09-07T00:00:00.000Z");
    vi.useFakeTimers({ now: loginAt, toFake: ["Date"] });
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "refresh@example.com");
    const originalExpiresAt = expiresAtMs(await loadSoleSession(db));

    const refreshAt = loginAt + UPDATE_AGE_MS + 1_000;
    vi.setSystemTime(refreshAt);
    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    expect(sessionCookieMaxAgeSeconds(meRes.headers.getSetCookie())).toBe(
      SESSION_EXPIRES_IN_SECONDS,
    );
    expect(meRes.headers.getSetCookie().some((value) => /HttpOnly/i.test(value))).toBe(true);

    const refreshedExpiresAt = expiresAtMs(await loadSoleSession(db));
    expect(refreshedExpiresAt).not.toBe(originalExpiresAt);
    expect(refreshedExpiresAt).toBeGreaterThanOrEqual(
      refreshAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS,
    );
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

    const afterMs = expiresAtMs(await loadSoleSession(db));
    expect(afterMs).toBeGreaterThanOrEqual(refreshAt + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(afterMs).toBeLessThanOrEqual(refreshAt + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("既存セッションは設定変更だけでは延びず、延長条件を満たす確認でその時点から 30 日になる", async () => {
    const { app, db } = await createTestApp();
    const signedUp = await signUpSession(app, "legacy@example.com");
    const cookie = withoutSessionDataCookie(signedUp.cookie);
    const created = await loadSoleSession(db);
    const now = Date.now();
    const legacyExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    await setSessionExpiresAt(db, created.id, legacyExpiresAt);

    expect(expiresAtMs(await loadSoleSession(db))).toBe(legacyExpiresAt.getTime());

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(200);
    expect(sessionCookieMaxAgeSeconds(meRes.headers.getSetCookie())).toBe(
      SESSION_EXPIRES_IN_SECONDS,
    );

    const afterMs = expiresAtMs(await loadSoleSession(db));
    expect(afterMs).toBeGreaterThanOrEqual(now + EXPIRES_IN_MS - TIME_TOLERANCE_MS);
    expect(afterMs).toBeLessThanOrEqual(Date.now() + EXPIRES_IN_MS + TIME_TOLERANCE_MS);
  });

  it("更新されないまま期限切れになると保護 API は 401 で、延長して復活しない", async () => {
    const { app, db } = await createTestApp();
    const signedUp = await signUpSession(app, "expired@example.com");
    const cookie = withoutSessionDataCookie(signedUp.cookie);
    const created = await loadSoleSession(db);
    await setSessionExpiresAt(db, created.id, new Date(Date.now() - 1_000));

    const meRes = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(meRes.status).toBe(401);
    expect(await meRes.json()).toEqual({ error: "unauthorized" });
    expect(
      meRes.headers
        .getSetCookie()
        .some((value) => /session_token=/i.test(value) && /Max-Age=0/i.test(value)),
    ).toBe(true);

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
    const signedUp = await signUpSession(app, "client-expired@example.com");
    const cookie = withoutSessionDataCookie(signedUp.cookie);
    const created = await loadSoleSession(db);
    await setSessionExpiresAt(db, created.id, new Date(Date.now() - 1_000));

    const client = createApiClient({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set("Cookie", cookie);
        return app.request(input, { ...init, headers });
      },
    });
    const onUnauthorized = vi.fn();
    const queryClient = createQueryClient({ onUnauthorized });

    const error = await queryClient
      .fetchQuery(meQueryOptions(client))
      .catch((caught: unknown) => caught);
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
    // ブラウザからは session_token と session_data の両方が消える
    const cleared = signOutRes.headers.getSetCookie();
    expect(cleared.some((value) => /session_token=/i.test(value) && /Max-Age=0/i.test(value))).toBe(
      true,
    );

    const meRes = await app.request("/api/me", {
      headers: { Cookie: withoutSessionDataCookie(cookie) },
    });
    expect(meRes.status).toBe(401);
    expect(await meRes.json()).toEqual({ error: "unauthorized" });
  });
});

describe("セッションの Cookie キャッシュ", () => {
  it("ログイン応答は session_data を付けない", async () => {
    const { app } = await createTestApp();
    const { signUpRes } = await signUpSession(app, "cache@example.com");
    expect(signUpRes.headers.getSetCookie().some((value) => /session_data=/i.test(value))).toBe(
      false,
    );
  });

  it("session 行を消したらすぐ 401（署名付き Cookie だけでは通らない）", async () => {
    const { app, db } = await createTestApp();
    const { cookie } = await signUpSession(app, "cache-hit@example.com");
    const created = await loadSoleSession(db);
    await db.delete(session).where(eq(session.id, created.id));
    const res = await app.request("/api/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});
