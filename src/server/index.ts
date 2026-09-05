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
  let cachedAuth: Auth | undefined = options.auth;

  app.use(secureHeaders());

  const attachAuth = createMiddleware<AppEnv>(async (c, next) => {
    if (!cachedAuth) {
      cachedAuth = createAuthFromEnv(c.env, c.req.url);
    }
    c.set("auth", cachedAuth);
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
