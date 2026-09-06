import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  createDrinkLogSchema,
  drinkLogIdParamSchema,
  drinkLogSummaryQuerySchema,
} from "@/shared/drink-logs.ts";
import type { AppEnv } from "../app-env.ts";
import {
  createDrinkLog,
  deleteDrinkLog,
  getDrinkLogSummary,
  getOwnDrinkLog,
} from "../services/drink-logs.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate } from "../validation.ts";

export type DrinkLogRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
};

/**
 * 一覧 / PATCH は 3-05 で足す。固定パスの `/summary` は `/:id` より前に登録する。
 */
export function createDrinkLogsRoute(deps: DrinkLogRouteDeps) {
  return new Hono<AppEnv>()
    .get("/summary", validate("query", drinkLogSummaryQuerySchema), async (c) => {
      const user = c.get("user");
      const query = c.req.valid("query");
      const summary = await getDrinkLogSummary({
        db: deps.getDb(c),
        userId: user.id,
        query,
      });
      return c.json(summary);
    })
    .post("/", validate("json", createDrinkLogSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const log = await createDrinkLog({ db: deps.getDb(c), userId: user.id, body });
      return c.json(log, 201);
    })
    .get("/:id", validate("param", drinkLogIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const log = await getOwnDrinkLog(deps.getDb(c), user.id, id);
      return c.json(log);
    })
    .delete("/:id", validate("param", drinkLogIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      // #region agent log
      const debugResult = await deleteDrinkLog({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        logId: id,
      });
      c.header("x-agent-debug-deleted-count", String(debugResult.deletedCount));
      c.header("x-agent-debug-remaining-count", String(debugResult.remainingCount));
      // #endregion
      return c.json({ ok: true });
    });
}
