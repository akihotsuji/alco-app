import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { verifyAgeBodySchema } from "@/shared/age.ts";
import type { AppEnv } from "../app-env.ts";
import { hasAgeVerification, verifyAge } from "../services/age-verification.ts";
import { validate } from "../validation.ts";

export function createMeRoute(options: { getDb: (c: { env: Env }) => AppBatchDb }) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const user = c.get("user");
      const ageVerified = await hasAgeVerification(options.getDb(c), user.id);
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        ageVerified,
      });
    })
    .post("/age-verification", validate("json", verifyAgeBodySchema), async (c) => {
      const user = c.get("user");
      const { birthOn } = c.req.valid("json");
      await verifyAge({
        db: options.getDb(c),
        userId: user.id,
        birthOn,
      });
      return c.json({ ageVerified: true as const });
    });
}
