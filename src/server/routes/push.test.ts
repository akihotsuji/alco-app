import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { pushSubscriptions } from "@/db/schema.ts";
import { encodeBase64Url } from "@/shared/base64url.ts";
import { PUSH_MAX_SUBSCRIPTIONS_PER_USER, PUSH_SUBSCRIBE_RATE_MAX } from "@/shared/web-push.ts";
import type { VapidConfig } from "../env.ts";
import { pushSubscribeRateLimiter } from "../services/social-rate-limit.ts";
import {
  createTestApp,
  createTestUser,
  createTestUserPair,
  createUnverifiedTestUser,
} from "../test-helpers.ts";

type App = Awaited<ReturnType<typeof createTestApp>>["app"];

const ORIGIN = "http://localhost";

async function vapidConfig(): Promise<VapidConfig> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    publicKey: encodeBase64Url(raw),
    privateKey: jwk.d ?? "",
    subject: "https://sake-shiori.com",
  };
}

async function deviceKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    p256dh: encodeBase64Url(raw),
    auth: encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

async function subscriptionBody(
  endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`,
) {
  return { endpoint, expirationTime: null, keys: await deviceKeys() };
}

function putSubscription(app: App, cookie: string, body: unknown, origin = ORIGIN) {
  return app.request("/api/push/subscription", {
    method: "PUT",
    headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteSubscription(app: App, cookie: string, endpoint: string) {
  return app.request("/api/push/subscription", {
    method: "DELETE",
    headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

beforeEach(() => {
  pushSubscribeRateLimiter.reset();
});

describe("push API の認証・年齢ゲート", () => {
  it("未認証は 401", async () => {
    const { app } = await createTestApp();
    const body = await subscriptionBody();
    expect((await app.request("/api/push/config")).status).toBe(401);
    expect((await putSubscription(app, "", body)).status).toBe(401);
    expect((await deleteSubscription(app, "", body.endpoint)).status).toBe(401);
  });

  it("年齢未確認は 403 age_required", async () => {
    const { app } = await createTestApp();
    const unverified = await createUnverifiedTestUser(app, {
      name: "U",
      email: "push-age@example.com",
      password: "password1",
    });
    const config = await app.request("/api/push/config", {
      headers: { Cookie: unverified.cookie },
    });
    expect(config.status).toBe(403);
    expect(await config.json()).toEqual({ error: "age_required" });
    const put = await putSubscription(app, unverified.cookie, await subscriptionBody());
    expect(put.status).toBe(403);
  });
});

describe("GET /api/push/config", () => {
  it("鍵が無ければ available: false。秘密鍵は返さない", async () => {
    const { app } = await createTestApp({ vapid: null });
    const a = await createTestUser(app, {
      name: "A",
      email: "cfg-a@example.com",
      password: "password1",
    });
    const res = await app.request("/api/push/config", { headers: { Cookie: a.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ available: false, publicKey: null });
  });

  it("鍵があれば公開鍵だけ返す", async () => {
    const vapid = await vapidConfig();
    const { app } = await createTestApp({ vapid });
    const a = await createTestUser(app, {
      name: "A",
      email: "cfg-b@example.com",
      password: "password1",
    });
    const res = await app.request("/api/push/config", { headers: { Cookie: a.cookie } });
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ available: true, publicKey: vapid.publicKey });
    expect(text).not.toContain(vapid.privateKey);
  });
});

describe("PUT / DELETE /api/push/subscription", () => {
  it("保存・再登録（upsert）・削除ができ、鍵が無い環境でも受ける", async () => {
    const { app, db } = await createTestApp({ vapid: null });
    const a = await createTestUser(app, {
      name: "A",
      email: "sub-a@example.com",
      password: "password1",
    });
    const body = await subscriptionBody();
    const first = await putSubscription(app, a.cookie, body);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect((await putSubscription(app, a.cookie, body)).status).toBe(200);
    const rows = await db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: a.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      authSecret: body.keys.auth,
    });
    const removed = await deleteSubscription(app, a.cookie, body.endpoint);
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("許可リスト外・http・不正な鍵・userId 付きは 400", async () => {
    const { app, db } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "sub-bad@example.com",
      password: "password1",
    });
    const body = await subscriptionBody();
    for (const bad of [
      { ...body, endpoint: "https://evil.example/push" },
      { ...body, endpoint: "http://fcm.googleapis.com/fcm/send/x" },
      { ...body, endpoint: "https://169.254.169.254/latest" },
      { ...body, keys: { ...body.keys, p256dh: "AAAA" } },
      { ...body, keys: { ...body.keys, auth: "AAAA" } },
      { ...body, userId: "someone" },
    ]) {
      const res = await putSubscription(app, a.cookie, bad);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "validation_error" });
    }
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("Origin が違う書き込みは 400", async () => {
    const { app, db } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "sub-origin@example.com",
      password: "password1",
    });
    const res = await putSubscription(
      app,
      a.cookie,
      await subscriptionBody(),
      "https://evil.example",
    );
    expect(res.status).toBe(400);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("他人の購読は消せない。同じ endpoint を鍵なしで奪えない（404）", async () => {
    const { app, db } = await createTestApp();
    const [a, b] = await createTestUserPair(app, [
      { name: "A", email: "idor-a@example.com", password: "password1" },
      { name: "B", email: "idor-b@example.com", password: "password1" },
    ]);
    const body = await subscriptionBody();
    expect((await putSubscription(app, a.cookie, body)).status).toBe(200);

    const deleted = await deleteSubscription(app, b.cookie, body.endpoint);
    expect(deleted.status).toBe(200);
    const stolen = await putSubscription(app, b.cookie, { ...body, keys: await deviceKeys() });
    expect(stolen.status).toBe(404);
    expect(await stolen.json()).toEqual({ error: "not_found" });

    const [row] = await db.select().from(pushSubscriptions);
    expect(row).toMatchObject({ userId: a.id, p256dh: body.keys.p256dh });
  });

  it("同じ endpoint と鍵でも他人の行は付け替えず 404（別端末扱いで作り直させる）", async () => {
    const { app, db } = await createTestApp();
    const [a, b] = await createTestUserPair(app, [
      { name: "A", email: "shared-a@example.com", password: "password1" },
      { name: "B", email: "shared-b@example.com", password: "password1" },
    ]);
    const body = await subscriptionBody();
    expect((await putSubscription(app, a.cookie, body)).status).toBe(200);
    const res = await putSubscription(app, b.cookie, body);
    expect(res.status).toBe(404);
    const rows = await db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(a.id);
    const other = await subscriptionBody();
    expect((await putSubscription(app, b.cookie, other)).status).toBe(200);
  });

  it("1 ユーザーの端末は上限まで。超えたら古い順に消える", async () => {
    const { app, db } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "cap@example.com",
      password: "password1",
    });
    const endpoints: string[] = [];
    for (let i = 0; i <= PUSH_MAX_SUBSCRIPTIONS_PER_USER; i += 1) {
      const body = await subscriptionBody();
      endpoints.push(body.endpoint);
      expect((await putSubscription(app, a.cookie, body)).status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const rows = await db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, a.id));
    expect(rows).toHaveLength(PUSH_MAX_SUBSCRIPTIONS_PER_USER);
    expect(rows.map((row) => row.endpoint)).not.toContain(endpoints[0]);
  });

  it("購読の保存は回数上限を超えると 429", async () => {
    const { app } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "rate@example.com",
      password: "password1",
    });
    const body = await subscriptionBody();
    for (let i = 0; i < PUSH_SUBSCRIBE_RATE_MAX; i += 1) {
      expect((await putSubscription(app, a.cookie, body)).status).toBe(200);
    }
    const limited = await putSubscription(app, a.cookie, body);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
  });

  it("ログアウトでその端末の購読が消える（セッション削除の CASCADE）", async () => {
    const { app, db } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "logout@example.com",
      password: "password1",
    });
    expect((await putSubscription(app, a.cookie, await subscriptionBody())).status).toBe(200);
    const out = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { Cookie: a.cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(out.status).toBe(200);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("アカウント削除で購読が消える", async () => {
    const { app, db } = await createTestApp();
    const a = await createTestUser(app, {
      name: "A",
      email: "delete@example.com",
      password: "password1",
    });
    expect((await putSubscription(app, a.cookie, await subscriptionBody())).status).toBe(200);
    const res = await app.request("/api/me/account-deletion", {
      method: "POST",
      headers: { Cookie: a.cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true, password: "password1" }),
    });
    expect(res.status).toBe(202);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });
});
