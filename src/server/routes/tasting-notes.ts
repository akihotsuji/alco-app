import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBatchDb } from "@/db/index.ts";
import {
  createTastingNoteSchema,
  tastingNoteIdParamSchema,
  tastingNotesQuerySchema,
  updateTastingNoteSchema,
} from "@/shared/tasting-notes.ts";
import type { AppEnv } from "../app-env.ts";
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
};

export function createTastingNotesRoute(deps: TastingNoteRouteDeps) {
  return new Hono<AppEnv>()
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
