import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  bottleIdParamSchema,
  bottleMutationBodySchema,
  bottlesQuerySchema,
  createBottleSchema,
  reorderBottlesSchema,
  updateBottleSchema,
} from "@/shared/bottles.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import {
  consumeBottle,
  createBottles,
  deleteBottle,
  getOwnBottle,
  listBottles,
  reorderBottles,
  restoreBottle,
  updateBottle,
} from "../services/bottles.ts";
import type { LabelRecognizer } from "../services/label-recognizer/index.ts";
import { recognizeBottleLabel } from "../services/label-recognizer/recognize.ts";
import type { PhotoBucket } from "../services/photos.ts";
import { validate, validateJsonAllowingEmpty, validJson } from "../validation.ts";

export type BottleRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
  getLabelRecognizer: (c: Context<AppEnv>) => LabelRecognizer;
  recognizeTimeoutMs?: number;
};

/**
 * `recognize` / `order` は `/:id` より先。`consume` / `restore` は `/:id` 配下。
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

      // 裏面は任意。あれば表面と同じサイズ上限で受け、MIME / 長辺の検証はサービス側で表面と同じく行う。
      const back = form.get("back");
      let backBytes: Uint8Array | undefined;
      if (back !== null) {
        if (!(back instanceof File)) {
          throw new ApiError("validation_error", {
            fields: { back: ["画像ファイルを指定してください"] },
          });
        }
        if (back.size > PHOTO_MAX_BYTES) {
          throw new ApiError("payload_too_large");
        }
        backBytes = new Uint8Array(await back.arrayBuffer());
        if (backBytes.byteLength > PHOTO_MAX_BYTES) {
          throw new ApiError("payload_too_large");
        }
      }

      const result = await recognizeBottleLabel({
        db: deps.getDb(c),
        userId: user.id,
        bytes,
        backBytes,
        recognizer: deps.getLabelRecognizer(c),
        timeoutMs: deps.recognizeTimeoutMs,
      });
      return c.json(result);
    })
    .put("/order", validate("json", reorderBottlesSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const result = await reorderBottles({
        db: deps.getDb(c),
        userId: user.id,
        body,
      });
      return c.json(result);
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
      validateJsonAllowingEmpty(bottleMutationBodySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const bottle = await consumeBottle({
          db: deps.getDb(c),
          userId: user.id,
          bottleId: id,
          body: validJson(c),
        });
        return c.json(bottle);
      },
    )
    .post(
      "/:id/restore",
      validate("param", bottleIdParamSchema),
      validateJsonAllowingEmpty(bottleMutationBodySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const bottle = await restoreBottle({
          db: deps.getDb(c),
          userId: user.id,
          bottleId: id,
          body: validJson(c),
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
    .delete(
      "/:id",
      validate("param", bottleIdParamSchema),
      validateJsonAllowingEmpty(bottleMutationBodySchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        await deleteBottle({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: user.id,
          bottleId: id,
          body: validJson(c),
        });
        return c.json({ ok: true });
      },
    );
}
