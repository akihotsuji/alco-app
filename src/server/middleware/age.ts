import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppBatchDb } from "@/db/index.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError } from "../errors.ts";
import { hasAgeVerification } from "../services/age-verification.ts";
import { isPublicApiRoute } from "./auth.ts";

export type AgeDbResolver = (c: Context<AppEnv>) => AppBatchDb;

const AGE_EXEMPT_EXACT = [
  { method: "GET", path: "/api/me" },
  { method: "POST", path: "/api/me/age-verification" },
] as const;

export function isAgeExemptApiRoute(method: string, path: string): boolean {
  if (isPublicApiRoute(method, path)) {
    return true;
  }
  const normalized = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  return AGE_EXEMPT_EXACT.some((route) => route.method === normalized && route.path === path);
}

/**
 * 認証後に掛ける年齢確認。未確認の機能 API は 403 `age_required`。
 * `GET /api/me` と `POST /api/me/age-verification` と公開ルートは通す。
 */
export function createAgeGuard(getDb: AgeDbResolver) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (isAgeExemptApiRoute(c.req.method, c.req.path)) {
      await next();
      return;
    }

    const user = c.get("user");
    if (!user) {
      throw new ApiError("unauthorized");
    }
    const verified = await hasAgeVerification(getDb(c), user.id);
    if (!verified) {
      throw new ApiError("age_required");
    }
    await next();
  });
}
