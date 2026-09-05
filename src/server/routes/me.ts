import { Hono } from "hono";
import type { AppEnv } from "../app-env.ts";
import { requireAuth } from "../middleware/require-auth.ts";

export const meRoute = new Hono<AppEnv>().get("/", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});
