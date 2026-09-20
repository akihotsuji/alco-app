import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import { tastingNoteIdParamSchema, tastingNotesQuerySchema } from "@/shared/tasting-notes.ts";
import type { AppEnv } from "../app-env.ts";
import type { PhotoBucket } from "../services/photos.ts";
import {
  deleteTastingNote,
  getOwnTastingNote,
  listTastingNotes,
} from "../services/tasting-notes.ts";
import { validate } from "../validation.ts";

export type TastingNoteRouteDeps = {
  getDb: (c: Context<AppEnv>) => AppBatchDb;
  getBucket: (c: Context<AppEnv>) => PhotoBucket;
};

/**
 * 一覧・詳細・削除のみ。作成・更新は `POST` / `PATCH /api/drink-logs` の `tastingNote`。
 */
export function createTastingNotesRoute(deps: TastingNoteRouteDeps) {
  return new Hono<AppEnv>()
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
