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
  { method: "POST", path: "/api/me/account-deletion" },
] as const;

export function isAgeExemptApiRoute(method: string, path: string): boolean {
  if (isPublicApiRoute(method, path)) {
    return true;
  }
  const normalized = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  return AGE_EXEMPT_EXACT.some((route) => route.method === normalized && route.path === path);
}

/** isolate ごとの上限。超えたら古い順に捨てる（LRU ではなく FIFO で足りる） */
export const AGE_VERIFIED_CACHE_LIMIT = 1000;

/**
 * 「確認済み」だけを覚える。年齢確認は一度成立したら取り消す経路が無い（`age_verifications` に
 * DELETE が無い。ユーザー削除は CASCADE で行ごと消え、その userId のセッションも無くなる）ため、
 * 肯定結果の再利用は安全。未確認（否定）は覚えない。次の確認 POST が即座に効くようにする。
 */
export function createVerifiedUserCache(limit = AGE_VERIFIED_CACHE_LIMIT) {
  const verified = new Set<string>();
  return {
    has(userId: string): boolean {
      return verified.has(userId);
    },
    add(userId: string): void {
      if (verified.has(userId)) {
        return;
      }
      if (verified.size >= limit) {
        const oldest = verified.values().next().value;
        if (oldest !== undefined) {
          verified.delete(oldest);
        }
      }
      verified.add(userId);
    },
    get size(): number {
      return verified.size;
    },
  };
}

/**
 * 認証後に掛ける年齢確認。未確認の機能 API は 403 `age_required`。
 * `GET /api/me` と `POST /api/me/age-verification` と `POST /api/me/account-deletion` と公開ルートは通す。
 * 確認済みユーザーは isolate 内で覚え、毎リクエストの D1 往復を省く。
 */
export function createAgeGuard(
  getDb: AgeDbResolver,
  cache: ReturnType<typeof createVerifiedUserCache> = createVerifiedUserCache(),
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (isAgeExemptApiRoute(c.req.method, c.req.path)) {
      await next();
      return;
    }

    const user = c.get("user");
    if (!user) {
      throw new ApiError("unauthorized");
    }
    if (!cache.has(user.id)) {
      const verified = await hasAgeVerification(getDb(c), user.id);
      if (!verified) {
        throw new ApiError("age_required");
      }
      cache.add(user.id);
    }
    await next();
  });
}
