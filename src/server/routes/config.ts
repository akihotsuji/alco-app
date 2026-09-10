import type { Context } from "hono";
import { Hono } from "hono";
import { publicConfigSchema } from "@/shared/turnstile.ts";
import type { AppEnv } from "../app-env.ts";
import { readTurnstileConfig } from "../env.ts";

export type ConfigRouteDeps = {
  getSiteKey?: (c: Context<AppEnv>) => string | null;
};

function siteKeyFromEnv(c: Context<AppEnv>): string | null {
  return readTurnstileConfig(c.env ?? {})?.siteKey ?? null;
}

/** 公開。サイトキー以外は出さない（spec/features/rate-limit-abuse.md）。 */
export function createConfigRoute(deps: ConfigRouteDeps = {}) {
  return new Hono<AppEnv>().get("/", (c) => {
    const resolve = deps.getSiteKey ?? siteKeyFromEnv;
    return c.json(publicConfigSchema.parse({ turnstileSiteKey: resolve(c) }));
  });
}
