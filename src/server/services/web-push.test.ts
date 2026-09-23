import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenFromInviteUrl } from "@/client/lib/social-invite.ts";
import { pushSubscriptions, session } from "@/db/schema.ts";
import { decodeBase64Url, encodeBase64Url } from "@/shared/base64url.ts";
import type { VapidConfig } from "../env.ts";
import { createTestApp, createTestUserPair } from "../test-helpers.ts";
import { pushSubscribeRateLimiter } from "./social-rate-limit.ts";
import { type PushFetch, sendSocialPush } from "./web-push.ts";

type TestContext = Awaited<ReturnType<typeof createTestApp>>;
type App = TestContext["app"];

const ORIGIN = "http://localhost";
const LIKE_ID = "11111111-1111-4111-8111-111111111111";

type Device = {
  endpoint: string;
  keys: CryptoKeyPair;
  p256dh: string;
  auth: string;
};

type Sent = { url: string; init: RequestInit };

async function vapidConfig(): Promise<VapidConfig & { verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return {
    publicKey: encodeBase64Url(raw),
    privateKey: jwk.d ?? "",
    subject: "https://sake-shiori.com",
    verifyKey: pair.publicKey,
  };
}

async function device(host = "fcm.googleapis.com"): Promise<Device> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  return {
    endpoint: `https://${host}/fcm/send/${crypto.randomUUID()}`,
    keys,
    p256dh: encodeBase64Url(raw),
    auth: encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

function b64(value: string): Uint8Array<ArrayBuffer> {
  const out = decodeBase64Url(value);
  if (!out) {
    throw new Error("bad base64url");
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const sign = async (key: Uint8Array, data: Uint8Array) => {
    const k = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, new Uint8Array(data)));
  };
  const prk = await sign(salt, ikm);
  return (await sign(prk, new Uint8Array([...info, 1]))).slice(0, len);
}

/** ブラウザ側と同じ手順で復号し、ペイロードの中身を取り出す */
async function decrypt(dev: Device, body: Uint8Array): Promise<unknown> {
  const salt = body.slice(0, 16);
  const idLen = body[20] ?? 0;
  const asPublic = body.slice(21, 21 + idLen);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, dev.keys.privateKey, 256),
  );
  const te = new TextEncoder();
  const ikm = await hkdf(
    b64(dev.auth),
    ecdh,
    new Uint8Array([...te.encode("WebPush: info\u0000"), ...b64(dev.p256dh), ...asPublic]),
    32,
  );
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\u0000"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\u0000"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, body.slice(21 + idLen)),
  );
  return JSON.parse(new TextDecoder().decode(padded.slice(0, -1)));
}

function recordingFetch(status = 201) {
  const sent: Sent[] = [];
  const fetch: PushFetch = async (url, init) => {
    sent.push({ url, init });
    return new Response(null, { status });
  };
  return { sent, fetch };
}

function executionCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      },
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext,
    settle: () => Promise.all(pending),
  };
}

function headers(cookie: string) {
  return { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" };
}

async function subscribe(app: App, cookie: string, dev: Device) {
  const res = await app.request("/api/push/subscription", {
    method: "PUT",
    headers: headers(cookie),
    body: JSON.stringify({ endpoint: dev.endpoint, keys: { p256dh: dev.p256dh, auth: dev.auth } }),
  });
  expect(res.status).toBe(200);
}

async function inviteToken(app: App, cookie: string) {
  const res = await app.request("/api/friends/invitations", { headers: { Cookie: cookie } });
  const token = tokenFromInviteUrl(((await res.json()) as { url: string }).url);
  return token ?? "";
}

async function sendRequest(
  app: App,
  fromCookie: string,
  toCookie: string,
  ctx?: ExecutionContext,
): Promise<string> {
  const token = await inviteToken(app, toCookie);
  const res = await app.request(
    "/api/friends/requests",
    { method: "POST", headers: headers(fromCookie), body: JSON.stringify({ token }) },
    {},
    ctx,
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { request: { id: string } }).request.id;
}

function headerValue(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

beforeEach(() => {
  pushSubscribeRateLimiter.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup(options: { vapid?: VapidConfig | null; status?: number } = {}) {
  const vapid = options.vapid === undefined ? await vapidConfig() : options.vapid;
  const recorder = recordingFetch(options.status);
  const test = await createTestApp({ vapid, pushFetch: recorder.fetch });
  const [a, b] = await createTestUserPair(test.app, [
    { name: "Aさん", email: `push-a-${crypto.randomUUID()}@example.com`, password: "password1" },
    { name: "Bさん", email: `push-b-${crypto.randomUUID()}@example.com`, password: "password1" },
  ]);
  return { ...test, vapid, ...recorder, a, b };
}

describe("プッシュ送信（申請・承認・リアクション）", () => {
  it("友達申請で受信者の端末へ暗号化した「種別 + 未読数」だけを送り、応答を待たせない", async () => {
    const { app, a, b, sent, vapid } = await setup();
    const dev = await device();
    await subscribe(app, a.cookie, dev);
    const { ctx, settle } = executionCtx();
    await sendRequest(app, b.cookie, a.cookie, ctx);
    await settle();

    expect(sent).toHaveLength(1);
    const [call] = sent;
    expect(call?.url).toBe(dev.endpoint);
    expect(call?.init.method).toBe("POST");
    expect(headerValue(call?.init ?? {}, "Content-Encoding")).toBe("aes128gcm");
    expect(headerValue(call?.init ?? {}, "TTL")).toBe("86400");
    expect(headerValue(call?.init ?? {}, "Topic")).toBe("social");
    expect(headerValue(call?.init ?? {}, "Urgency")).toBe("normal");
    const authorization = headerValue(call?.init ?? {}, "Authorization") ?? "";
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
    expect(match?.[2]).toBe(vapid?.publicKey);
    const [h = "", c = "", s = ""] = (match?.[1] ?? "").split(".");
    const claims = JSON.parse(new TextDecoder().decode(b64(c))) as {
      aud: string;
      exp: number;
      sub: string;
    };
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("https://sake-shiori.com");
    expect(claims.exp - Date.now() / 1000).toBeLessThanOrEqual(24 * 60 * 60);
    if (vapid && "verifyKey" in vapid) {
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        vapid.verifyKey as CryptoKey,
        b64(s),
        new TextEncoder().encode(`${h}.${c}`),
      );
      expect(ok).toBe(true);
    }

    const body = new Uint8Array(call?.init.body as Uint8Array);
    const payload = await decrypt(dev, body);
    expect(payload).toEqual({ v: 1, type: "friend_request", unread: 1 });
    const plain = JSON.stringify(payload);
    expect(plain).not.toContain("Bさん");
    expect(plain).not.toContain(b.id);
  });

  it("承認とリアクションでも相手へ送る。送信者本人の端末には送らない", async () => {
    const { app, a, b, sent } = await setup();
    const devA = await device();
    const devB = await device("updates.push.services.mozilla.com");
    await subscribe(app, a.cookie, devA);
    await subscribe(app, b.cookie, devB);

    const requestId = await sendRequest(app, b.cookie, a.cookie);
    const accepted = executionCtx();
    const accept = await app.request(
      `/api/friends/requests/${requestId}/accept`,
      { method: "POST", headers: headers(a.cookie) },
      {},
      accepted.ctx,
    );
    expect(accept.status).toBe(200);
    await accepted.settle();
    expect(sent.map((call) => call.url)).toEqual([devB.endpoint]);
    expect(await decrypt(devB, new Uint8Array(sent[0]?.init.body as Uint8Array))).toEqual({
      v: 1,
      type: "friend_accepted",
      unread: 1,
    });

    const log = await app.request("/api/drink-logs", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({
        drinkType: "wine",
        volumeMl: 125,
        abvPercent: 12,
        drinkName: "秘密のワイン",
      }),
    });
    const logId = ((await log.json()) as { id: string }).id;
    const shared = await app.request("/api/social/shares", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({
        operationKey: crypto.randomUUID(),
        source: { kind: "drink_log", drinkLogId: logId },
      }),
    });
    expect(shared.status).toBe(201);
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;

    const reacted = executionCtx();
    const reaction = await app.request(
      `/api/social/posts/${postId}/reaction`,
      {
        method: "PUT",
        headers: headers(b.cookie),
        body: JSON.stringify({ reactionTypeId: LIKE_ID }),
      },
      {},
      reacted.ctx,
    );
    expect(reaction.status).toBe(200);
    await reacted.settle();
    const last = sent.at(-1);
    expect(last?.url).toBe(devA.endpoint);
    const payload = await decrypt(devA, new Uint8Array(last?.init.body as Uint8Array));
    expect(payload).toMatchObject({ v: 1, type: "reaction" });
    expect(JSON.stringify(payload)).not.toMatch(/秘密のワイン|like|いいね/);
  });

  it("既に未読の通知の更新では送り直さない", async () => {
    const { app, a, b, sent } = await setup();
    await subscribe(app, a.cookie, await device());
    const requestId = await sendRequest(app, b.cookie, a.cookie);
    const accept = await app.request(`/api/friends/requests/${requestId}/accept`, {
      method: "POST",
      headers: headers(a.cookie),
    });
    expect(accept.status).toBe(200);
    const log = await app.request("/api/drink-logs", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({ drinkType: "beer", volumeMl: 350, abvPercent: 5 }),
    });
    const logId = ((await log.json()) as { id: string }).id;
    const shared = await app.request("/api/social/shares", {
      method: "POST",
      headers: headers(a.cookie),
      body: JSON.stringify({
        operationKey: crypto.randomUUID(),
        source: { kind: "drink_log", drinkLogId: logId },
      }),
    });
    const postId = ((await shared.json()) as { post: { id: string } }).post.id;
    for (let i = 0; i < 2; i += 1) {
      const run = executionCtx();
      await app.request(
        `/api/social/posts/${postId}/reaction`,
        {
          method: "PUT",
          headers: headers(b.cookie),
          body: JSON.stringify({ reactionTypeId: LIKE_ID }),
        },
        {},
        run.ctx,
      );
      await run.settle();
    }
    expect(sent).toHaveLength(1);
  });

  it("鍵が無い環境では何も送らず、申請は成功する", async () => {
    const { app, a, b, sent } = await setup({ vapid: null });
    await subscribe(app, a.cookie, await device());
    const { ctx, settle } = executionCtx();
    await sendRequest(app, b.cookie, a.cookie, ctx);
    await settle();
    expect(sent).toHaveLength(0);
  });
});

describe("sendSocialPush の後始末", () => {
  it.each([404, 410])("配信サービスが %i を返した購読は消す", async (status) => {
    const { app, db, a, vapid, fetch } = await setup({ status });
    await subscribe(app, a.cookie, await device());
    const result = await sendSocialPush({ db, vapid, userId: a.id, type: "reaction", fetch });
    expect(result).toMatchObject({ attempted: 1, sent: 0, removed: 1 });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("その他の失敗は行を残し、ログに endpoint・鍵を出さない", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, db, a, vapid, fetch } = await setup({ status: 500 });
    const dev = await device();
    await subscribe(app, a.cookie, dev);
    const result = await sendSocialPush({ db, vapid, userId: a.id, type: "reaction", fetch });
    expect(result).toMatchObject({ attempted: 1, failed: 1, removed: 0 });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith("[push] send failed", {
      status: 500,
      service: "fcm.googleapis.com",
    });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(dev.endpoint);
    expect(logged).not.toContain(dev.p256dh);
    expect(logged).not.toContain(dev.auth);
    expect(logged).not.toContain(vapid?.privateKey ?? "never");
  });

  it("通信例外でも投げず、ログは状態だけ", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, db, a, vapid } = await setup();
    const dev = await device();
    await subscribe(app, a.cookie, dev);
    const result = await sendSocialPush({
      db,
      vapid,
      userId: a.id,
      type: "friend_request",
      fetch: async () => {
        throw new Error(`boom ${dev.endpoint}`);
      },
    });
    expect(result).toMatchObject({ attempted: 1, failed: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(dev.endpoint);
  });

  it("セッションが期限切れの購読には送らず消す", async () => {
    const { app, db, a, vapid, fetch, sent } = await setup();
    await subscribe(app, a.cookie, await device());
    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.userId, a.id));
    const result = await sendSocialPush({ db, vapid, userId: a.id, type: "reaction", fetch });
    expect(result).toMatchObject({ attempted: 0, removed: 1 });
    expect(sent).toHaveLength(0);
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("鍵が無ければ DB にも配信サービスにも触れない", async () => {
    const { app, db, a, fetch, sent } = await setup();
    await subscribe(app, a.cookie, await device());
    const result = await sendSocialPush({ db, vapid: null, userId: a.id, type: "reaction", fetch });
    expect(result).toEqual({ attempted: 0, sent: 0, removed: 0, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("他人の購読には送らない", async () => {
    const { app, db, a, b, vapid, fetch, sent } = await setup();
    const devA = await device();
    await subscribe(app, a.cookie, devA);
    await subscribe(app, b.cookie, await device());
    await sendSocialPush({ db, vapid, userId: a.id, type: "reaction", fetch });
    expect(sent.map((call) => call.url)).toEqual([devA.endpoint]);
  });
});
