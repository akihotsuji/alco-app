import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  createMyDrinkSchema,
  myDrinkIdParamSchema,
  myDrinksQuerySchema,
  oneTapDrinkLogSchema,
  updateMyDrinkSchema,
} from "@/shared/my-drinks.ts";
import type { AppEnv } from "../app-env.ts";
import {
  createDrinkLogFromMyDrink,
  createMyDrink,
  deleteMyDrink,
  getOwnMyDrink,
  listMyDrinks,
  updateMyDrink,
} from "../services/my-drinks.ts";
import { validate } from "../validation.ts";

export type MyDrinksRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
};

export function createMyDrinksRoute(deps: MyDrinksRouteDeps) {
  return new Hono<AppEnv>()
    .get("/", validate("query", myDrinksQuerySchema), async (c) => {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await listMyDrinks(deps.getDb(c), user.id, query);
      return c.json(result);
    })
    .post("/", validate("json", createMyDrinkSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const result = await createMyDrink({ db: deps.getDb(c), userId: user.id, body });
      return c.json(result, 201);
    })
    .post(
      "/:id/log",
      validate("param", myDrinkIdParamSchema),
      validate("json", oneTapDrinkLogSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await createDrinkLogFromMyDrink({
          db: deps.getDb(c),
          userId: user.id,
          myDrinkId: id,
          body,
        });
        return c.json(result, 201);
      },
    )
    .get("/:id", validate("param", myDrinkIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const result = await getOwnMyDrink(deps.getDb(c), user.id, id);
      return c.json(result);
    })
    .patch(
      "/:id",
      validate("param", myDrinkIdParamSchema),
      validate("json", updateMyDrinkSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await updateMyDrink({
          db: deps.getDb(c),
          userId: user.id,
          myDrinkId: id,
          body,
        });
        return c.json(result);
      },
    )
    .delete("/:id", validate("param", myDrinkIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      await deleteMyDrink(deps.getDb(c), user.id, id);
      return c.json({ ok: true });
    });
}
