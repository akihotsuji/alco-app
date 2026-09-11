import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { photoIdParamSchema, photoPatchSchema, photoUploadFieldsSchema } from "@/shared/photos.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import {
  createPhoto,
  deletePhoto,
  getOwnPhoto,
  matchesIfNoneMatch,
  PHOTO_CONTENT_CACHE_CONTROL,
  type PhotoBucket,
  photoContentEtag,
  readOwnedPhotoBody,
  toPhotoMeta,
  updatePhoto,
} from "../services/photos.ts";
import { validate } from "../validation.ts";

export type PhotoRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
  dailyLimit?: number;
};

export function createPhotosRoute(deps: PhotoRouteDeps) {
  return new Hono<AppEnv>()
    .post("/", async (c) => {
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

      const fields = photoUploadFieldsSchema.parse({
        bottleId: form.get("bottleId") ?? undefined,
        tastingNoteId: form.get("tastingNoteId") ?? undefined,
        drinkLogId: form.get("drinkLogId") ?? undefined,
        sortOrder: form.get("sortOrder") ?? undefined,
      });

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > PHOTO_MAX_BYTES) {
        throw new ApiError("payload_too_large");
      }

      const meta = await createPhoto({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        bytes,
        fields,
        dailyLimit: deps.dailyLimit,
      });
      return c.json(meta, 201);
    })
    .get("/:id/content", validate("param", photoIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      // 所有確認は 304 でも省かない（他人・不明は同じ 404）。一致すれば R2 を読まずに返す
      const row = await getOwnPhoto(deps.getDb(c), user.id, id);
      const etag = photoContentEtag(row.id);
      if (matchesIfNoneMatch(c.req.header("If-None-Match"), etag)) {
        return c.body(null, 304, {
          ETag: etag,
          "Cache-Control": PHOTO_CONTENT_CACHE_CONTROL,
        });
      }
      const content = await readOwnedPhotoBody(deps.getBucket(c), row);
      return c.body(content.body, 200, {
        "Content-Type": content.contentType,
        "Cache-Control": PHOTO_CONTENT_CACHE_CONTROL,
        "Content-Disposition": "inline",
        ETag: etag,
      });
    })
    .get("/:id", validate("param", photoIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const row = await getOwnPhoto(deps.getDb(c), user.id, id);
      return c.json(toPhotoMeta(row));
    })
    .patch(
      "/:id",
      validate("param", photoIdParamSchema),
      validate("json", photoPatchSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const patch = c.req.valid("json");
        const meta = await updatePhoto({
          db: deps.getDb(c),
          userId: user.id,
          photoId: id,
          patch,
        });
        return c.json(meta);
      },
    )
    .delete("/:id", validate("param", photoIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      await deletePhoto({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        photoId: id,
      });
      return c.json({ ok: true });
    });
}
