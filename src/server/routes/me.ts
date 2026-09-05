import { Hono } from "hono";
import type { AppEnv } from "../app-env.ts";

/** 認証は `authGuard`（/api/* 全体）が担う。`image` は返さない（spec/api-design.md 4.2）。 */
export const meRoute = new Hono<AppEnv>().get("/", (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});
