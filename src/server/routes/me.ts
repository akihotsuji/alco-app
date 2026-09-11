import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  accountDeletionAcceptedSchema,
  accountDeletionBodySchema,
} from "@/shared/account-deletion.ts";
import { verifyAgeBodySchema } from "@/shared/age.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError } from "../errors.ts";
import { appendSetCookieHeaders } from "../middleware/auth.ts";
import { acceptAccountDeletion } from "../services/account-deletion.ts";
import { runAccountDeletionJobs } from "../services/account-deletion-jobs.ts";
import { accountDeletionRateLimiter } from "../services/account-deletion-rate-limit.ts";
import { listAuthProviders } from "../services/account-providers.ts";
import { hasAgeVerification, verifyAge } from "../services/age-verification.ts";
import { assertSameOrigin } from "../services/origin.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate } from "../validation.ts";

function scheduleBackground(
  c: { executionCtx?: { waitUntil?: (promise: Promise<unknown>) => void } },
  task: Promise<unknown>,
) {
  try {
    const waitUntil = c.executionCtx?.waitUntil;
    if (waitUntil) {
      waitUntil(task);
      return;
    }
  } catch {
    // app.request() など waitUntil が無い／投げるとフォールバック
  }
  void task;
}

export function createMeRoute(options: {
  getDb: (c: { env: Env }) => AppBatchDb;
  getBucket: (c: { env: Env }) => PhotoBucket;
}) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const user = c.get("user");
      const db = options.getDb(c);
      const [ageVerified, providers] = await Promise.all([
        hasAgeVerification(db, user.id),
        listAuthProviders(db, user.id),
      ]);
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        ageVerified,
        hasPassword: providers.hasPassword,
        hasGoogle: providers.hasGoogle,
      });
    })
    .post("/age-verification", validate("json", verifyAgeBodySchema), async (c) => {
      const user = c.get("user");
      const { birthOn } = c.req.valid("json");
      await verifyAge({
        db: options.getDb(c),
        userId: user.id,
        birthOn,
      });
      return c.json({ ageVerified: true as const });
    })
    .post("/account-deletion", validate("json", accountDeletionBodySchema), async (c) => {
      assertSameOrigin(c);
      const user = c.get("user");
      if (!accountDeletionRateLimiter.consume(user.id)) {
        throw new ApiError("rate_limited");
      }
      const db = options.getDb(c);
      const bucket = options.getBucket(c);
      await acceptAccountDeletion({
        db,
        auth: c.get("auth"),
        headers: c.req.raw.headers,
        userId: user.id,
        email: user.email,
        sessionCreatedAt: c.get("sessionCreatedAt"),
        body: c.req.valid("json"),
      });
      try {
        const signedOut = await c.get("auth").api.signOut({
          headers: c.req.raw.headers,
          returnHeaders: true,
        });
        appendSetCookieHeaders(c, signedOut.headers);
      } catch {
        // Cookie 失効に失敗しても受付は確定済み
      }
      scheduleBackground(c, runAccountDeletionJobs({ db, bucket }));
      c.header("Cache-Control", "no-store");
      return c.json(accountDeletionAcceptedSchema.parse({ status: "accepted" as const }), 202);
    });
}
