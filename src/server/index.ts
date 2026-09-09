import "@/shared/zod-config.ts";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppBatchDb } from "@/db/index.ts";
import { createD1Db } from "@/db/index.ts";
import type { AppEnv } from "./app-env.ts";
import { type Auth, createAuthFromEnv } from "./auth.ts";
import { canonicalRedirectResponse } from "./canonical-redirect.ts";
import { type AuthResolver, createAuthGuard } from "./middleware/auth.ts";
import { errorHandler, notFoundHandler } from "./middleware/error.ts";
import { createBottlesRoute } from "./routes/bottles.ts";
import { createDrinkLogsRoute } from "./routes/drink-logs.ts";
import { healthRoute } from "./routes/health.ts";
import { meRoute } from "./routes/me.ts";
import { createMyDrinksRoute } from "./routes/my-drinks.ts";
import { createPhotosRoute } from "./routes/photos.ts";
import { createTastingNotesRoute } from "./routes/tasting-notes.ts";
import { createWorkersAiDrinkRecognizer } from "./services/drink-recognizer/workers-ai.ts";
import { reportUnexpectedError } from "./services/error-alert.ts";
import type { LabelRecognizer } from "./services/label-recognizer/index.ts";
import { createWorkersAiRecognizer } from "./services/label-recognizer/workers-ai.ts";
import { createWorkersAiNoteRecognizer } from "./services/note-recognizer/workers-ai.ts";
import { runDailyGc } from "./services/photo-gc.ts";
import { type PhotoBucket, wrapR2Bucket } from "./services/photos.ts";
import { envAssets, isHashedAssetPath, serveHashedAsset } from "./static-assets.ts";

export type CreateAppOptions = {
  auth?: Auth;
  db?: AppBatchDb;
  photos?: PhotoBucket;
  labelRecognizer?: LabelRecognizer;
  drinkRecognizer?: LabelRecognizer;
  noteRecognizer?: LabelRecognizer;
  recognizeTimeoutMs?: number;
};

/**
 * Worker が返すのは `/api/*` の JSON（と写真バイナリ）と、存在しない `/assets/*` の 404。
 * 残りの SPA は静的アセット配信。dev は `run_worker_first: ["/api/*", "/assets/*"]`。
 * 本番はホスト正規化のため `run_worker_first: true` にし、非 API は ASSETS へ渡す。
 * SPA の CSP は `public/_headers`。API 応答はスクリプトも埋め込みも要らないため全面禁止にする。
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

  const routeDeps = {
    getDb: (c: { env: Env }) => getDb(c),
    getBucket: (c: { env: Env }) => getBucket(c),
  };
  const photosRoute = createPhotosRoute(routeDeps);
  const drinkLogsRoute = createDrinkLogsRoute({
    ...routeDeps,
    getDrinkRecognizer: (c) => options.drinkRecognizer ?? createWorkersAiDrinkRecognizer(c.env.AI),
    recognizeTimeoutMs: options.recognizeTimeoutMs,
  });
  const myDrinksRoute = createMyDrinksRoute(routeDeps);
  const bottlesRoute = createBottlesRoute({
    ...routeDeps,
    getLabelRecognizer: (c) => options.labelRecognizer ?? createWorkersAiRecognizer(c.env.AI),
    recognizeTimeoutMs: options.recognizeTimeoutMs,
  });
  const tastingNotesRoute = createTastingNotesRoute({
    ...routeDeps,
    getNoteRecognizer: (c) => options.noteRecognizer ?? createWorkersAiNoteRecognizer(c.env.AI),
    recognizeTimeoutMs: options.recognizeTimeoutMs,
  });

  // RPC（2-04）に型を出すため、業務ルートはチェーンして返す。固定パスは `:id` より前に置く
  return app
    .route("/api/health", healthRoute)
    .route("/api/me", meRoute)
    .route("/api/drink-logs", drinkLogsRoute)
    .route("/api/my-drinks", myDrinksRoute)
    .route("/api/photos", photosRoute)
    .route("/api/bottles", bottlesRoute)
    .route("/api/tasting-notes", tastingNotesRoute);
}

export type AppType = ReturnType<typeof createApp>;

export const app = createApp();

export async function handleScheduled(env: Env, nowMs = Date.now()) {
  try {
    return await runDailyGc({
      db: createD1Db(env.DB),
      bucket: wrapR2Bucket(env.PHOTOS),
      nowMs,
    });
  } catch (err) {
    console.error("[gc] unhandled error", err);
    await reportUnexpectedError({
      env,
      kind: "scheduled_error",
      method: "CRON",
      path: "scheduled",
      err,
    });
    throw err;
  }
}

export async function handleFetch(request: Request, env: Env, ctx: ExecutionContext) {
  let pathname = "/";
  try {
    const redirected = canonicalRedirectResponse(request.url, env);
    if (redirected) {
      return redirected;
    }

    pathname = new URL(request.url).pathname;
    if (isHashedAssetPath(pathname)) {
      return serveHashedAsset(request, env);
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    const assets = envAssets(env);
    if (assets) {
      return assets.fetch(request);
    }
    return app.fetch(request, env, ctx);
  } catch (err) {
    console.error("[fetch] unhandled error", err);
    await reportUnexpectedError({
      env,
      kind: "unhandled_error",
      method: request.method,
      path: pathname,
      err,
    });
    throw err;
  }
}

export default {
  fetch: handleFetch,
  scheduled: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env, controller.scheduledTime));
  },
};
