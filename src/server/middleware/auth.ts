import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env.ts";
import type { Auth } from "../auth.ts";
import { ApiError } from "../errors.ts";

export type AuthResolver = (c: Context<AppEnv>) => Auth;

/**
 * 認証なしで通す `/api` の唯一のリスト（spec/api-design.md 2.3。オーナー承認済み）。
 * 追加は仕様更新と再承認が先。
 */
export const PUBLIC_API_ROUTES = [
  { method: "GET", path: "/api/health" },
  { method: "*", prefix: "/api/auth/" },
] as const satisfies readonly ({ method: "GET"; path: string } | { method: "*"; prefix: string })[];

export function isPublicApiRoute(method: string, path: string): boolean {
  // Hono は HEAD を GET ハンドラで処理するので、公開判定も GET に揃える
  const normalized = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  return PUBLIC_API_ROUTES.some((route) => {
    if ("path" in route) {
      return route.method === normalized && route.path === path;
    }
    return path.startsWith(route.prefix);
  });
}

/**
 * `/api/*` 全体に掛ける認証ミドルウェア。公開ルート以外はセッション必須（401）。
 * ハンドラは `c.get("user").id` だけを所有者キーにし、リクエスト中の userId は見ない。
 * Auth の組み立て（D1 接続）は公開ルートでは行わない。
 */
export function createAuthGuard(resolveAuth: AuthResolver) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (isPublicApiRoute(c.req.method, c.req.path)) {
      await next();
      return;
    }

    const auth = resolveAuth(c);
    c.set("auth", auth);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      throw new ApiError("unauthorized");
    }
    c.set("user", {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
    await next();
  });
}
