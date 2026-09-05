import "@/shared/zod-config.ts";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppSqliteDb } from "@/db/index.ts";
import { createD1Db } from "@/db/index.ts";
import type { AppEnv } from "./app-env.ts";
import { type Auth, createAuthFromEnv } from "./auth.ts";
import { type AuthResolver, createAuthGuard } from "./middleware/auth.ts";
import { errorHandler, notFoundHandler } from "./middleware/error.ts";
import { healthRoute } from "./routes/health.ts";
import { meRoute } from "./routes/me.ts";
import { createPhotosRoute } from "./routes/photos.ts";
import { runDailyGc } from "./services/photo-gc.ts";
import { type PhotoBucket, wrapR2Bucket } from "./services/photos.ts";

export type CreateAppOptions = {
  auth?: Auth;
  db?: AppSqliteDb;
  photos?: PhotoBucket;
};

/**
 * Worker が返すのは `/api/*` の JSON（と写真バイナリ）だけ。SPA の HTML / JS / CSS は
 * 静的アセット配信（`run_worker_first: ["/api/*"]`）なので、そちらの CSP は `public/_headers`。
 * API 応答はスクリプトも埋め込みも要らないため全面禁止にする。
 */
const apiSecureHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
  xFrameOptions: "DENY",
});

/** Better Auth は baseURL 依存なので、リクエストの origin ごとに 1 つ組み立てて再利用する。 */
function createAuthResolver(options: CreateAppOptions): AuthResolver {
  const authByOrigin = new Map<string, Auth>();
  return (c) => {
    if (options.auth) {
      return options.auth;
    }
    const origin = new URL(c.req.url).origin;
    let auth = authByOrigin.get(origin);
    if (!auth) {
      auth = createAuthFromEnv(c.env, c.req.url);
      authByOrigin.set(origin, auth);
    }
    return auth;
  };
}

/**
 * 登録順（spec/api-design.md 5 章）:
 * secure-headers → 認証 MW（公開ルートは内部で除外）→ Better Auth → 業務ルート → 404
 */
export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();
  const resolveAuth = createAuthResolver(options);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.use(apiSecureHeaders);
  app.use("/api/*", createAuthGuard(resolveAuth));

  app.all("/api/auth/*", (c) => resolveAuth(c).handler(c.req.raw));

  const getDb = (c: { env: Env }) => options.db ?? createD1Db(c.env.DB);
  const getBucket = (c: { env: Env }) => options.photos ?? wrapR2Bucket(c.env.PHOTOS);

  const photosRoute = createPhotosRoute({
    getDb: (c) => getDb(c),
    getBucket: (c) => getBucket(c),
  });

  // RPC（2-04）に型を出すため、業務ルートはチェーンして返す。固定パスは `:id` より前に置く
  return app
    .route("/api/health", healthRoute)
    .route("/api/me", meRoute)
    .route("/api/photos", photosRoute);
}

export type AppType = ReturnType<typeof createApp>;

export const app = createApp();

export async function handleScheduled(env: Env, nowMs = Date.now()) {
  return runDailyGc({
    db: createD1Db(env.DB),
    bucket: wrapR2Bucket(env.PHOTOS),
    nowMs,
  });
}

export default {
  fetch: app.fetch,
  scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env, controller.scheduledTime));
  },
};
