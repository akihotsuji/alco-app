import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  bottleIdParamSchema,
  bottlesQuerySchema,
  createBottleSchema,
  updateBottleSchema,
} from "@/shared/bottles.ts";
import type { AppEnv } from "../app-env.ts";
import {
  createBottles,
  deleteBottle,
  getOwnBottle,
  listBottles,
  updateBottle,
} from "../services/bottles.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate } from "../validation.ts";

export type BottleRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
};

/**
 * 4-02 は CRUD のみ。`recognize` / `consume` / `restore` は後続タスクで `/:id` より前または配下に足す。
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
