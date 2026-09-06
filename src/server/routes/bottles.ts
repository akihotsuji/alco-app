import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  bottleIdParamSchema,
  bottlesQuerySchema,
  createBottleSchema,
  emptyJsonBodySchema,
  updateBottleSchema,
} from "@/shared/bottles.ts";
import type { AppEnv } from "../app-env.ts";
import {
  consumeBottle,
  createBottles,
  deleteBottle,
  getOwnBottle,
  listBottles,
  restoreBottle,
  updateBottle,
} from "../services/bottles.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate, validateJsonAllowingEmpty } from "../validation.ts";

export type BottleRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
};

/**
 * `recognize` は 4-07。`consume` / `restore` は `/:id` 配下（固定パスは id より先に不要）。
 */
export function createBottlesRoute(deps: BottleRouteDeps) {
  return new Hono<AppEnv>()
    .get("/", validate("query", bottlesQuerySchema), async (c) => {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await listBottles({
        db: deps.getDb(c),
        userId: user.id,
        query,
      });
      return c.json(result);
    })
    .post("/", validate("json", createBottleSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const created = await createBottles({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        body,
      });
      return c.json(created, 201);
    })
    .get("/:id", validate("param", bottleIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const bottle = await getOwnBottle(deps.getDb(c), user.id, id);
      return c.json(bottle);
    })
    .post(
      "/:id/consume",
      validate("param", bottleIdParamSchema),
      validateJsonAllowingEmpty(emptyJsonBodySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const bottle = await consumeBottle({
          db: deps.getDb(c),
          userId: user.id,
          bottleId: id,
        });
        return c.json(bottle);
      },
    )
    .post(
      "/:id/restore",
      validate("param", bottleIdParamSchema),
      validateJsonAllowingEmpty(emptyJsonBodySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const bottle = await restoreBottle({
          db: deps.getDb(c),
          userId: user.id,
          bottleId: id,
        });
        return c.json(bottle);
      },
    )
    .patch(
      "/:id",
      validate("param", bottleIdParamSchema),
      validate("json", updateBottleSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const bottle = await updateBottle({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: user.id,
          bottleId: id,
          body,
        });
        return c.json(bottle);
      },
    )
    .delete("/:id", validate("param", bottleIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      await deleteBottle({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        bottleId: id,
      });
      return c.json({ ok: true });
    });
}
