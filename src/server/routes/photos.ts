import type { Context } from "hono";
import { Hono } from "hono";
import type { AppSqliteDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import { photoIdParamSchema, photoPatchSchema, photoUploadFieldsSchema } from "@/shared/photos.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError } from "../errors.ts";
import {
  createPhoto,
  deletePhoto,
  getOwnPhoto,
  type PhotoBucket,
  readPhotoContent,
  toPhotoMeta,
  updatePhoto,
} from "../services/photos.ts";
import { validate } from "../validation.ts";

export type PhotoRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppSqliteDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
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
          fields: { "": ["リクエストの形式が正しくありません"] },
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
      });
      return c.json(meta, 201);
    })
    .get("/:id/content", validate("param", photoIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const content = await readPhotoContent({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        photoId: id,
      });
      return c.body(content.body, 200, {
        "Content-Type": content.contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": "inline",
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
