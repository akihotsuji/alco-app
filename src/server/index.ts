import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

export const app = new Hono();

app.use(secureHeaders());

app.get("/api/health", (c) => c.json({ ok: true }));

app.all("/api/*", (c) => c.json({ ok: false }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false }, 500);
});

export default app;
