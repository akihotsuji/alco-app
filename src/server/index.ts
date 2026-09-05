import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./app-env.ts";
import { type Auth, createAuthFromEnv } from "./auth.ts";
import { meRoute } from "./routes/me.ts";

export type CreateAppOptions = {
  auth?: Auth;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppEnv>();
  const authByOrigin = new Map<string, Auth>();

  app.use(secureHeaders());

  const attachAuth = createMiddleware<AppEnv>(async (c, next) => {
    let auth = options.auth;
    if (!auth) {
      const origin = new URL(c.req.url).origin;
      auth = authByOrigin.get(origin);
      if (!auth) {
        auth = createAuthFromEnv(c.env, c.req.url);
        authByOrigin.set(origin, auth);
      }
    }
    c.set("auth", auth);
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.all("/api/auth/*", attachAuth, (c) => c.get("auth").handler(c.req.raw));

  app.use("/api/me", attachAuth);
  app.route("/api/me", meRoute);

  app.all("/api/*", (c) => c.json({ ok: false }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ ok: false }, 500);
  });

  return app;
}

export const app = createApp();
export default app;
