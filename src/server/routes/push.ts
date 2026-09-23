import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { SOCIAL_CONTENT_CACHE_CONTROL } from "@/shared/social.ts";
import {
  type PushConfig,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
} from "@/shared/web-push.ts";
import type { AppEnv } from "../app-env.ts";
import type { VapidConfig } from "../env.ts";
import { ApiError } from "../errors.ts";
import { assertSameOrigin } from "../services/origin.ts";
import { pushSubscribeRateLimiter } from "../services/social-rate-limit.ts";
import { deletePushSubscription, savePushSubscription } from "../services/web-push.ts";
import { validate } from "../validation.ts";

export type PushRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getVapid: (c: Context<AppEnv>) => VapidConfig | null;
};

/** spec/api-design.md 4.13。購読の一覧は返さない。所有者はセッションの userId だけ */
export function createPushRoute(deps: PushRouteDeps) {
  return new Hono<AppEnv>()
    .get("/config", (c) => {
      c.header("Cache-Control", SOCIAL_CONTENT_CACHE_CONTROL);
      const vapid = deps.getVapid(c);
      const config: PushConfig = {
        available: vapid !== null,
        publicKey: vapid?.publicKey ?? null,
      };
      return c.json(config);
    })
    .put("/subscription", validate("json", pushSubscriptionBodySchema), async (c) => {
      assertSameOrigin(c);
      c.header("Cache-Control", SOCIAL_CONTENT_CACHE_CONTROL);
      const user = c.get("user");
      const sessionId = c.get("sessionId");
      if (!sessionId) {
        throw new ApiError("unauthorized");
      }
      if (!pushSubscribeRateLimiter.consume(user.id)) {
        throw new ApiError("rate_limited");
      }
      await savePushSubscription({
        db: deps.getDb(c),
        userId: user.id,
        sessionId,
        body: c.req.valid("json"),
      });
      return c.json({ ok: true as const });
    })
    .delete("/subscription", validate("json", pushUnsubscribeBodySchema), async (c) => {
      assertSameOrigin(c);
      c.header("Cache-Control", SOCIAL_CONTENT_CACHE_CONTROL);
      await deletePushSubscription(deps.getDb(c), c.get("user").id, c.req.valid("json").endpoint);
      return c.json({ ok: true as const });
    });
}
