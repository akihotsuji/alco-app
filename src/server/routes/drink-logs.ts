import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import {
  createDrinkLogSchema,
  drinkLogIdParamSchema,
  drinkLogSummaryQuerySchema,
  drinkLogsQuerySchema,
  updateDrinkLogSchema,
} from "@/shared/drink-logs.ts";
import { drinkLookupRequestSchema } from "@/shared/drink-recognize.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import {
  createDrinkLog,
  deleteDrinkLog,
  getDrinkLogSummary,
  getOwnDrinkLog,
  listDrinkLogs,
  updateDrinkLog,
} from "../services/drink-logs.ts";
import type { DrinkLookupRunner } from "../services/drink-recognizer/lookup-runner.ts";
import {
  lookupDrinkProduct,
  readDailyLimitFromEnv,
  recognizeDrinkPhoto,
} from "../services/drink-recognizer/recognize.ts";
import type { LabelRecognizer } from "../services/label-recognizer/index.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate } from "../validation.ts";

export type DrinkLogRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
  getDrinkRecognizer: (c: Context<AppEnv>) => LabelRecognizer;
  getDrinkLookup: (c: Context<AppEnv>) => DrinkLookupRunner;
  getEnv?: (c: Context<AppEnv>) => object;
  recognizeTimeoutMs?: number;
  lookupTimeoutMs?: number;
};

/**
 * 固定パスの `/summary` と `/recognize` `/recognize/lookup` は `/:id` より前に登録する。
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
    .post("/recognize", async (c) => {
      const user = c.get("user");
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new ApiError("validation_error", {
          fields: { "": [MALFORMED_REQUEST_MESSAGE] },
        });
      }

      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ApiError("validation_error", {
          fields: { file: ["画像ファイルを指定してください"] },
        });
      }
      if (file.size > PHOTO_MAX_BYTES) {
        throw new ApiError("payload_too_large");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > PHOTO_MAX_BYTES) {
        throw new ApiError("payload_too_large");
      }

      const result = await recognizeDrinkPhoto({
        db: deps.getDb(c),
        userId: user.id,
        bytes,
        recognizer: deps.getDrinkRecognizer(c),
        env: deps.getEnv?.(c) ?? c.env,
        timeoutMs: deps.recognizeTimeoutMs,
        dailyLimit: readDailyLimitFromEnv(deps.getEnv?.(c) ?? c.env),
      });
      return c.json(result);
    })
    .post("/recognize/lookup", validate("json", drinkLookupRequestSchema), async (c) => {
      const user = c.get("user");
      const request = c.req.valid("json");
      const result = await lookupDrinkProduct({
        db: deps.getDb(c),
        userId: user.id,
        request,
        runner: deps.getDrinkLookup(c),
        timeoutMs: deps.lookupTimeoutMs,
        dailyLimit: readDailyLimitFromEnv(deps.getEnv?.(c) ?? c.env),
      });
      return c.json(result);
    })
    .post("/", validate("json", createDrinkLogSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const log = await createDrinkLog({ db: deps.getDb(c), userId: user.id, body });
      return c.json(log, 201);
    })
    .get("/", validate("query", drinkLogsQuerySchema), async (c) => {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await listDrinkLogs({ db: deps.getDb(c), userId: user.id, query });
      return c.json(result);
    })
    .get("/:id", validate("param", drinkLogIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const log = await getOwnDrinkLog(deps.getDb(c), user.id, id);
      return c.json(log);
    })
    .patch(
      "/:id",
      validate("param", drinkLogIdParamSchema),
      validate("json", updateDrinkLogSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const log = await updateDrinkLog({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: user.id,
          logId: id,
          body,
        });
        return c.json(log);
      },
    )
    .delete("/:id", validate("param", drinkLogIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      await deleteDrinkLog({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        logId: id,
      });
      return c.json({ ok: true });
    });
}
