import { and, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { pushSubscriptions, session } from "@/db/schema.ts";
import { decodeBase64Url } from "@/shared/base64url.ts";
import type { SocialNotificationType } from "@/shared/social.ts";
import {
  isAllowedPushEndpoint,
  PUSH_MAX_SUBSCRIPTIONS_PER_USER,
  PUSH_PAYLOAD_VERSION,
  PUSH_TOPIC,
  PUSH_TTL_SECONDS,
  type PushPayload,
  type PushSubscriptionBody,
} from "@/shared/web-push.ts";
import type { AppEnv } from "../app-env.ts";
import type { VapidConfig } from "../env.ts";
import { ApiError } from "../errors.ts";
import type { SocialUnreadSink } from "./social-notifications.ts";
import { unreadNotificationCount } from "./social-notifications.ts";
import {
  createVapidJwt,
  encryptPushPayload,
  importVapidSigningKey,
  vapidAuthorization,
} from "./web-push-crypto.ts";

/** spec/features/web-push.md 5 章。endpoint・鍵・JWT はログにもレスポンスにも出さない */

export type PushFetch = (url: string, init: RequestInit) => Promise<Response>;

export const PUSH_SEND_TIMEOUT_MS = 10_000;
const VAPID_JWT_TTL_SEC = 12 * 60 * 60;
const encoder = new TextEncoder();

export async function savePushSubscription(input: {
  db: AppBatchDb;
  userId: string;
  sessionId: string;
  body: PushSubscriptionBody;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const { endpoint, keys } = input.body;
  const [existing] = await input.db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  if (existing) {
    // 他人の行は書き換えない（存在も示さない）。端末側は購読を作り直して別 endpoint で登録し直す
    if (existing.userId !== input.userId) {
      throw new ApiError("not_found");
    }
    await input.db
      .update(pushSubscriptions)
      .set({
        sessionId: input.sessionId,
        p256dh: keys.p256dh,
        authSecret: keys.auth,
        updatedAt: now,
      })
      .where(
        and(eq(pushSubscriptions.id, existing.id), eq(pushSubscriptions.userId, input.userId)),
      );
  } else {
    await input.db.insert(pushSubscriptions).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      sessionId: input.sessionId,
      endpoint,
      p256dh: keys.p256dh,
      authSecret: keys.auth,
      createdAt: now,
      updatedAt: now,
    });
  }
  await trimSubscriptions(input.db, input.userId);
}

async function trimSubscriptions(db: AppBatchDb, userId: string) {
  const overflow = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.updatedAt), desc(pushSubscriptions.id))
    .limit(100)
    .offset(PUSH_MAX_SUBSCRIPTIONS_PER_USER);
  if (overflow.length === 0) {
    return;
  }
  await db.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      inArray(
        pushSubscriptions.id,
        overflow.map((row) => row.id),
      ),
    ),
  );
}

export async function deletePushSubscription(
  db: AppBatchDb,
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

export type PushSendResult = {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
};

function serviceHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "invalid";
  }
}

function logFailure(endpoint: string, status: number | "error") {
  console.warn("[push] send failed", { status, service: serviceHost(endpoint) });
}

/**
 * 受信者の有効な端末へ「種別 + 未読数」だけを送る。鍵が無ければ何もしない。
 * 404 / 410 は購読の失効として行を消す。例外は投げない（`waitUntil` の中で走る）。
 */
export async function sendSocialPush(input: {
  db: AppBatchDb;
  vapid: VapidConfig | null;
  userId: string;
  type: SocialNotificationType;
  fetch: PushFetch;
  now?: Date;
  timeoutMs?: number;
}): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: 0, sent: 0, removed: 0, failed: 0 };
  if (!input.vapid) {
    return result;
  }
  const now = input.now ?? new Date();
  const rows = await input.db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      authSecret: pushSubscriptions.authSecret,
      sessionExpiresAt: session.expiresAt,
    })
    .from(pushSubscriptions)
    .innerJoin(session, eq(session.id, pushSubscriptions.sessionId))
    .where(eq(pushSubscriptions.userId, input.userId))
    .limit(PUSH_MAX_SUBSCRIPTIONS_PER_USER);
  if (rows.length === 0) {
    return result;
  }

  const stale = rows.filter((row) => row.sessionExpiresAt.getTime() <= now.getTime());
  if (stale.length > 0) {
    await removeRows(
      input.db,
      input.userId,
      stale.map((row) => row.id),
    );
    result.removed += stale.length;
  }
  const live = rows.filter(
    (row) => row.sessionExpiresAt.getTime() > now.getTime() && isAllowedPushEndpoint(row.endpoint),
  );
  if (live.length === 0) {
    return result;
  }

  const payload: PushPayload = {
    v: PUSH_PAYLOAD_VERSION,
    type: input.type,
    unread: await unreadNotificationCount(input.db, input.userId),
  };
  const plaintext = encoder.encode(JSON.stringify(payload));
  const signingKey = await importVapidSigningKey(input.vapid);
  const expiresAtSec = Math.floor(now.getTime() / 1000) + VAPID_JWT_TTL_SEC;
  const jwtByAudience = new Map<string, Promise<string>>();
  const vapid = input.vapid;
  const gone: string[] = [];

  await Promise.all(
    live.map(async (row) => {
      result.attempted += 1;
      try {
        const uaPublic = decodeBase64Url(row.p256dh);
        const authSecret = decodeBase64Url(row.authSecret);
        if (!uaPublic || !authSecret) {
          gone.push(row.id);
          return;
        }
        const audience = new URL(row.endpoint).origin;
        let jwt = jwtByAudience.get(audience);
        if (!jwt) {
          jwt = createVapidJwt({ signingKey, audience, subject: vapid.subject, expiresAtSec });
          jwtByAudience.set(audience, jwt);
        }
        const body = await encryptPushPayload({ plaintext, uaPublic, authSecret });
        const response = await input.fetch(row.endpoint, {
          method: "POST",
          headers: {
            Authorization: vapidAuthorization(await jwt, vapid.publicKey),
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: String(PUSH_TTL_SECONDS),
            Urgency: "normal",
            Topic: PUSH_TOPIC,
          },
          body,
          // 許可リスト外へ転送させない（SSRF）。3xx は失敗として扱う
          redirect: "manual",
          signal: AbortSignal.timeout(input.timeoutMs ?? PUSH_SEND_TIMEOUT_MS),
        });
        await response.body?.cancel().catch(() => undefined);
        if (response.status === 404 || response.status === 410) {
          gone.push(row.id);
          return;
        }
        if (!response.ok) {
          result.failed += 1;
          logFailure(row.endpoint, response.status);
          return;
        }
        result.sent += 1;
      } catch {
        result.failed += 1;
        logFailure(row.endpoint, "error");
      }
    }),
  );
  if (gone.length > 0) {
    await removeRows(input.db, input.userId, gone);
    result.removed += gone.length;
  }
  return result;
}

async function removeRows(db: AppBatchDb, userId: string, ids: string[]) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), inArray(pushSubscriptions.id, ids)));
}

/** app.request() には ExecutionContext が無く getter が投げる。そのときは送らない */
function runAfterResponse(c: Context<AppEnv>, task: () => Promise<unknown>): void {
  let ctx: { waitUntil(promise: Promise<unknown>): void };
  try {
    ctx = c.executionCtx;
  } catch {
    return;
  }
  ctx.waitUntil(
    task().catch(() => {
      console.warn("[push] dispatch failed");
    }),
  );
}

export type SocialPushDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getVapid: (c: Context<AppEnv>) => VapidConfig | null;
  fetch: PushFetch;
};

/** ルートが `upsertNotification` に渡す「新しく未読になった」フック。応答を待たせない */
export function createSocialPushNotifier(deps: SocialPushDeps) {
  return (c: Context<AppEnv>): SocialUnreadSink => {
    return (recipientUserId, type) => {
      const vapid = deps.getVapid(c);
      if (!vapid) {
        return;
      }
      const db = deps.getDb(c);
      runAfterResponse(c, () =>
        sendSocialPush({ db, vapid, userId: recipientUserId, type, fetch: deps.fetch }),
      );
    };
  };
}
