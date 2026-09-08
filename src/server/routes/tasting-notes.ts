import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { PHOTO_MAX_BYTES } from "@/shared/constants.ts";
import {
  createTastingNoteSchema,
  tastingNoteIdParamSchema,
  tastingNotesQuerySchema,
  updateTastingNoteSchema,
} from "@/shared/tasting-notes.ts";
import type { AppEnv } from "../app-env.ts";
import { ApiError, MALFORMED_REQUEST_MESSAGE } from "../errors.ts";
import type { LabelRecognizer } from "../services/label-recognizer/index.ts";
import { recognizeNotePhoto } from "../services/note-recognizer/recognize.ts";
import type { PhotoBucket } from "../services/photos.ts";
import {
  createTastingNote,
  deleteTastingNote,
  getOwnTastingNote,
  listTastingNotes,
  updateTastingNote,
} from "../services/tasting-notes.ts";
import { validate } from "../validation.ts";

export type TastingNoteRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
  getNoteRecognizer: (c: Context<AppEnv>) => LabelRecognizer;
  recognizeTimeoutMs?: number;
};

/**
 * 固定パスの `/recognize` は `/:id` より前に登録する。
 */
export function createTastingNotesRoute(deps: TastingNoteRouteDeps) {
  return new Hono<AppEnv>()
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

      const result = await recognizeNotePhoto({
        db: deps.getDb(c),
        userId: user.id,
        bytes,
        recognizer: deps.getNoteRecognizer(c),
        timeoutMs: deps.recognizeTimeoutMs,
      });
      return c.json(result);
    })
    .post("/", validate("json", createTastingNoteSchema), async (c) => {
      const user = c.get("user");
      const body = c.req.valid("json");
      const note = await createTastingNote({ db: deps.getDb(c), userId: user.id, body });
      return c.json(note, 201);
    })
    .get("/", validate("query", tastingNotesQuerySchema), async (c) => {
      const user = c.get("user");
      const query = c.req.valid("query");
      const result = await listTastingNotes({ db: deps.getDb(c), userId: user.id, query });
      return c.json(result);
    })
    .get("/:id", validate("param", tastingNoteIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const note = await getOwnTastingNote(deps.getDb(c), user.id, id);
      return c.json(note);
    })
    .patch(
      "/:id",
      validate("param", tastingNoteIdParamSchema),
      validate("json", updateTastingNoteSchema),
      async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const note = await updateTastingNote({
          db: deps.getDb(c),
          bucket: deps.getBucket(c),
          userId: user.id,
          noteId: id,
          body,
        });
        return c.json(note);
      },
    )
    .delete("/:id", validate("param", tastingNoteIdParamSchema), async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      await deleteTastingNote({
        db: deps.getDb(c),
        bucket: deps.getBucket(c),
        userId: user.id,
        noteId: id,
      });
      return c.json({ ok: true });
    });
}
