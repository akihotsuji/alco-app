import { Hono } from "hono";
import type { AppEnv } from "../app-env.ts";

/** 公開エンドポイント（spec/features/health.md）。内部情報を返さない。 */
export const healthRoute = new Hono<AppEnv>().get("/", (c) => c.json({ ok: true }));
