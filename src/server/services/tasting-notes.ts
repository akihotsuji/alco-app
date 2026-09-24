import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { drinkLogs, photos, tastingNotes } from "@/db/schema.ts";
import { escapeLike } from "@/shared/bottles.ts";
import type { BottleState, DrinkType } from "@/shared/constants.ts";
import {
  type DrinkLogTastingNoteInput,
  normalizeNoteText,
  snapshotDrinkName,
  TASTING_NOTE_MESSAGES,
  TASTING_NOTE_PHOTO_MAX,
  type TastingNote,
  type TastingNoteBottle,
  type TastingNoteEmbedded,
  type TastingNoteListItem,
  type TastingNoteSummary,
  type TastingNotesQuery,
  type TastingNotesResponse,
} from "@/shared/tasting-notes.ts";
import { ApiError } from "../errors.ts";
import { takeLimitPlusOne } from "../lib/keyset-page.ts";
import { photosRemovedByPatch } from "../lib/photo-patch.ts";
import { requireOwnBottle } from "./bottles.ts";
import { type PhotoBucket, toPhotoMeta } from "./photos.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";

type NoteRow = typeof tastingNotes.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;
type DrinkLogRow = typeof drinkLogs.$inferSelect;
type BottleSnap = { id: string; name: string; drinkType: DrinkType; status: BottleState };

function toIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBottleEmbed(row: BottleSnap | null): TastingNoteBottle {
  if (!row) {
    return null;
  }
  return { id: row.id, name: row.name, status: row.status };
}

function toDrinkLogEmbed(log: DrinkLogRow) {
  return {
    id: log.id,
    volumeMl: log.volumeMl,
    abvPercent: log.abvPercent,
    alcoholG: log.alcoholG,
    drunkAt: toIso(log.drunkAt),
    drunkOn: log.drunkOn,
  };
}

export function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message);
}

export function toTastingNoteSummary(row: NoteRow): TastingNoteSummary {
  return {
    id: row.id,
    ratingX10: row.ratingX10,
    taste: row.taste,
  };
}

export function toTastingNoteEmbedded(
  row: NoteRow,
  photoRows: readonly PhotoRow[],
): TastingNoteEmbedded {
  const metas = photoRows.map(toPhotoMeta);
  return {
    id: row.id,
    ratingX10: row.ratingX10,
    taste: row.taste,
    appearance: row.appearance,
    aroma: row.aroma,
    finish: row.finish,
    photos: metas,
    photoCount: metas.length,
    thumbPhotoId: metas[0]?.id ?? null,
  };
}

export function toTastingNote(
  row: NoteRow,
  photoRows: readonly PhotoRow[],
  bottle: BottleSnap | null,
  log: DrinkLogRow,
): TastingNote {
  const metas = photoRows.map(toPhotoMeta);
  return {
    id: row.id,
    drinkLogId: row.drinkLogId,
    drinkName: row.drinkName,
    drinkType: row.drinkType,
    vintage: row.vintage,
    producer: row.producer,
    origin: row.origin,
    variety: row.variety,
    tastedOn: row.tastedOn,
    ratingX10: row.ratingX10,
    bottleId: row.bottleId,
    thumbPhotoId: metas[0]?.id ?? null,
    photoCount: metas.length,
    appearance: row.appearance,
    aroma: row.aroma,
    taste: row.taste,
    finish: row.finish,
    photos: metas,
    bottle: toBottleEmbed(bottle),
    drinkLog: toDrinkLogEmbed(log),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toTastingNoteListItem(
  row: NoteRow,
  thumbPhotoId: string | null,
  photoCount: number,
): TastingNoteListItem {
  return {
    id: row.id,
    drinkLogId: row.drinkLogId,
    drinkName: row.drinkName,
    drinkType: row.drinkType,
    vintage: row.vintage,
    tastedOn: row.tastedOn,
    ratingX10: row.ratingX10,
    bottleId: row.bottleId,
    thumbPhotoId,
    photoCount,
    taste: row.taste,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

const noteCursorSchema = z
  .object({
    id: z.string().uuid(),
    tastedOn: z.string(),
  })
  .strict();

function cursorError(): ApiError {
  return new ApiError("validation_error", {
    fields: { cursor: [TASTING_NOTE_MESSAGES.cursor] },
  });
}

function encodeCursor(row: NoteRow): string {
  return btoa(JSON.stringify({ id: row.id, tastedOn: row.tastedOn }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeCursor(cursor: string): z.infer<typeof noteCursorSchema> {
  try {
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    const parsed = noteCursorSchema.safeParse(payload);
    if (!parsed.success) {
      throw cursorError();
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw cursorError();
  }
}

function identityFromLog(log: DrinkLogRow) {
  return {
    drinkName: snapshotDrinkName(log.drinkName, log.drinkType),
    drinkType: log.drinkType,
    vintage: log.vintage,
    producer: log.producer,
    origin: log.origin,
    variety: log.variety,
    bottleId: log.bottleId,
    tastedOn: log.drunkOn,
  };
}

async function resolveUnattachedPhotos(
  db: AppBatchDb,
  userId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  if (photoIds.length === 0) {
    return [];
  }
  if (photoIds.length > TASTING_NOTE_PHOTO_MAX) {
    throw new ApiError("validation_error", {
      fields: { photoIds: [TASTING_NOTE_MESSAGES.photoIdsMax] },
    });
  }
  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        inArray(photos.id, [...photoIds]),
        eq(photos.userId, userId),
        isNull(photos.bottleId),
        isNull(photos.tastingNoteId),
        isNull(photos.drinkLogId),
      ),
    );
  if (rows.length !== photoIds.length) {
    throw new ApiError("not_found");
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return photoIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new ApiError("not_found");
    }
    return row;
  });
}

async function resolvePatchPhotos(
  db: AppBatchDb,
  userId: string,
  noteId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  if (photoIds.length > TASTING_NOTE_PHOTO_MAX) {
    throw new ApiError("validation_error", {
      fields: { photoIds: [TASTING_NOTE_MESSAGES.photoIdsMax] },
    });
  }
  if (photoIds.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(photos)
    .where(and(inArray(photos.id, [...photoIds]), eq(photos.userId, userId)));
  const valid = rows.every(
    (photo) =>
      photo.bottleId === null &&
      photo.drinkLogId === null &&
      (photo.tastingNoteId === null || photo.tastingNoteId === noteId),
  );
  if (!valid || rows.length !== photoIds.length) {
    throw new ApiError("not_found");
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return photoIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new ApiError("not_found");
    }
    return row;
  });
}

async function removeDetachedPhoto(
  db: AppBatchDb,
  bucket: PhotoBucket,
  userId: string,
  photo: PhotoRow,
): Promise<void> {
  try {
    await deletePhotoR2Objects(bucket, photo.r2Key);
    await db
      .delete(photos)
      .where(and(eq(photos.id, photo.id), eq(photos.userId, userId), isNull(photos.tastingNoteId)));
  } catch {
    // 未紐付けのまま残し、24h 後の日次 GC に再試行させる。
  }
}

async function loadNotePhotos(db: AppBatchDb, userId: string, noteId: string): Promise<PhotoRow[]> {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.tastingNoteId, noteId), eq(photos.userId, userId)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
}

async function loadBottleForNote(
  db: AppBatchDb,
  userId: string,
  bottleId: string | null,
): Promise<BottleSnap | null> {
  if (!bottleId) {
    return null;
  }
  try {
    const bottle = await requireOwnBottle(db, userId, bottleId);
    return {
      id: bottle.id,
      name: bottle.name,
      drinkType: bottle.drinkType,
      status: bottle.status,
    };
  } catch {
    return null;
  }
}

export async function loadNoteByDrinkLogId(
  db: AppBatchDb,
  userId: string,
  drinkLogId: string,
): Promise<NoteRow | undefined> {
  const [row] = await db
    .select()
    .from(tastingNotes)
    .where(and(eq(tastingNotes.drinkLogId, drinkLogId), eq(tastingNotes.userId, userId)));
  return row;
}

export async function loadEmbeddedTastingNote(
  db: AppBatchDb,
  userId: string,
  drinkLogId: string,
): Promise<TastingNoteEmbedded | null> {
  const row = await loadNoteByDrinkLogId(db, userId, drinkLogId);
  if (!row) {
    return null;
  }
  const photoRows = await loadNotePhotos(db, userId, row.id);
  return toTastingNoteEmbedded(row, photoRows);
}

export async function loadTastingNoteSummaries(
  db: AppBatchDb,
  userId: string,
  drinkLogIds: readonly string[],
): Promise<Map<string, TastingNoteSummary>> {
  const summaries = new Map<string, TastingNoteSummary>();
  if (drinkLogIds.length === 0) {
    return summaries;
  }
  const rows = await db
    .select()
    .from(tastingNotes)
    .where(
      and(inArray(tastingNotes.drinkLogId, [...drinkLogIds]), eq(tastingNotes.userId, userId)),
    );
  for (const row of rows) {
    summaries.set(row.drinkLogId, toTastingNoteSummary(row));
  }
  return summaries;
}

async function insertNoteForLog(input: {
  db: AppBatchDb;
  userId: string;
  log: DrinkLogRow;
  body: DrinkLogTastingNoteInput;
  now: Date;
}): Promise<NoteRow> {
  const { db, userId, log, body, now } = input;
  const identity = identityFromLog(log);
  const photoRows = await resolveUnattachedPhotos(db, userId, body.photoIds ?? []);
  const id = crypto.randomUUID();
  const row: NoteRow = {
    id,
    userId,
    drinkLogId: log.id,
    bottleId: identity.bottleId,
    drinkName: identity.drinkName,
    drinkType: identity.drinkType,
    vintage: identity.vintage,
    producer: identity.producer,
    origin: identity.origin,
    variety: identity.variety,
    tastedOn: identity.tastedOn,
    appearance: normalizeNoteText(body.appearance),
    aroma: normalizeNoteText(body.aroma),
    taste: normalizeNoteText(body.taste),
    finish: normalizeNoteText(body.finish),
    ratingX10: body.ratingX10,
    createdAt: now,
    updatedAt: now,
  };

  const insert = db.insert(tastingNotes).values(row);
  try {
    if (photoRows.length === 0) {
      await insert;
    } else {
      await db.batch([
        insert,
        ...photoRows.map((photo, index) =>
          db
            .update(photos)
            .set({ tastingNoteId: id, sortOrder: index, updatedAt: now })
            .where(
              and(
                eq(photos.id, photo.id),
                eq(photos.userId, userId),
                isNull(photos.tastingNoteId),
                isNull(photos.bottleId),
                isNull(photos.drinkLogId),
              ),
            ),
        ),
      ]);
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError("validation_error", {
        fields: { tastingNote: [TASTING_NOTE_MESSAGES.alreadyExists] },
      });
    }
    throw error;
  }
  return row;
}

async function updateNoteSensory(input: {
  db: AppBatchDb;
  bucket?: PhotoBucket;
  userId: string;
  current: NoteRow;
  log: DrinkLogRow;
  body: DrinkLogTastingNoteInput;
  now: Date;
}): Promise<NoteRow> {
  const { db, userId, current, log, body, now } = input;
  const identity = identityFromLog(log);
  const currentPhotoRows = await loadNotePhotos(db, userId, current.id);
  const desiredPhotoRows =
    body.photoIds === undefined
      ? undefined
      : await resolvePatchPhotos(db, userId, current.id, body.photoIds);
  const removedPhotoRows = photosRemovedByPatch(currentPhotoRows, desiredPhotoRows);
  const patch = {
    ...identity,
    ratingX10: body.ratingX10,
    appearance: normalizeNoteText(body.appearance),
    aroma: normalizeNoteText(body.aroma),
    taste: normalizeNoteText(body.taste),
    finish: normalizeNoteText(body.finish),
    updatedAt: now,
  };

  const updateStatement = db
    .update(tastingNotes)
    .set(patch)
    .where(and(eq(tastingNotes.id, current.id), eq(tastingNotes.userId, userId)));
  const detachStatement =
    removedPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ tastingNoteId: null, updatedAt: now })
          .where(
            and(
              inArray(
                photos.id,
                removedPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              eq(photos.tastingNoteId, current.id),
            ),
          )
      : null;
  const attachStatements =
    desiredPhotoRows?.map((photo, index) =>
      db
        .update(photos)
        .set({ tastingNoteId: current.id, sortOrder: index, updatedAt: now })
        .where(
          and(
            eq(photos.id, photo.id),
            eq(photos.userId, userId),
            isNull(photos.bottleId),
            isNull(photos.drinkLogId),
          ),
        ),
    ) ?? [];

  const statements = [
    updateStatement,
    ...(detachStatement ? [detachStatement] : []),
    ...attachStatements,
  ];
  const [firstStatement, ...restStatements] = statements;
  if (!firstStatement || restStatements.length === 0) {
    await updateStatement;
  } else {
    await db.batch([firstStatement, ...restStatements]);
  }

  if (desiredPhotoRows !== undefined && input.bucket) {
    await Promise.all(
      removedPhotoRows.map((photo) =>
        removeDetachedPhoto(db, input.bucket as PhotoBucket, userId, photo),
      ),
    );
  }

  return { ...current, ...patch };
}

export async function upsertTastingNoteForLog(input: {
  db: AppBatchDb;
  bucket?: PhotoBucket;
  userId: string;
  log: DrinkLogRow;
  body: DrinkLogTastingNoteInput;
  now?: Date;
}): Promise<NoteRow> {
  const now = input.now ?? new Date();
  const current = await loadNoteByDrinkLogId(input.db, input.userId, input.log.id);
  if (current) {
    return updateNoteSensory({
      db: input.db,
      bucket: input.bucket,
      userId: input.userId,
      current,
      log: input.log,
      body: input.body,
      now,
    });
  }
  return insertNoteForLog({
    db: input.db,
    userId: input.userId,
    log: input.log,
    body: input.body,
    now,
  });
}

export async function syncTastingNoteIdentityFromLog(input: {
  db: AppBatchDb;
  userId: string;
  log: DrinkLogRow;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const current = await loadNoteByDrinkLogId(input.db, input.userId, input.log.id);
  if (!current) {
    return;
  }
  const identity = identityFromLog(input.log);
  await input.db
    .update(tastingNotes)
    .set({ ...identity, updatedAt: now })
    .where(and(eq(tastingNotes.id, current.id), eq(tastingNotes.userId, input.userId)));
}

export async function getOwnTastingNote(
  db: AppBatchDb,
  userId: string,
  noteId: string,
): Promise<TastingNote> {
  const [joined] = await db
    .select({ note: tastingNotes, log: drinkLogs })
    .from(tastingNotes)
    .innerJoin(drinkLogs, eq(tastingNotes.drinkLogId, drinkLogs.id))
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
  if (!joined) {
    throw new ApiError("not_found");
  }
  const [photoRows, bottle] = await Promise.all([
    loadNotePhotos(db, userId, noteId),
    loadBottleForNote(db, userId, joined.note.bottleId),
  ]);
  return toTastingNote(joined.note, photoRows, bottle, joined.log);
}

export async function listTastingNotes(input: {
  db: AppBatchDb;
  userId: string;
  query: TastingNotesQuery;
}): Promise<TastingNotesResponse> {
  const { db, userId, query } = input;
  if (query.bottleId) {
    await requireOwnBottle(db, userId, query.bottleId);
  }

  const scope = [eq(tastingNotes.userId, userId)];
  if (query.bottleId) {
    scope.push(eq(tastingNotes.bottleId, query.bottleId));
  }
  const filters = [...scope];
  const q = query.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    filters.push(sql`${tastingNotes.drinkName} LIKE ${pattern} ESCAPE '\\'`);
  }
  if (query.drinkType) {
    filters.push(eq(tastingNotes.drinkType, query.drinkType));
  }
  if (query.ratingX10Min !== undefined) {
    filters.push(gte(tastingNotes.ratingX10, query.ratingX10Min));
  }
  if (query.ratingX10Max !== undefined) {
    filters.push(lte(tastingNotes.ratingX10, query.ratingX10Max));
  }

  const pageFilters = [...filters];
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const [anchor] = await db
      .select({ id: tastingNotes.id, tastedOn: tastingNotes.tastedOn })
      .from(tastingNotes)
      .where(and(eq(tastingNotes.id, cursor.id), eq(tastingNotes.userId, userId)));
    if (!anchor || anchor.tastedOn !== cursor.tastedOn) {
      throw cursorError();
    }
    pageFilters.push(
      sql`(${tastingNotes.tastedOn} < ${cursor.tastedOn} or (${tastingNotes.tastedOn} = ${cursor.tastedOn} and ${tastingNotes.id} < ${cursor.id}))`,
    );
  }

  const pageWhere = and(...pageFilters);
  const [totalRow, fetched, photoRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(tastingNotes)
      .where(and(...scope))
      .then((rows) => rows[0]),
    db
      .select()
      .from(tastingNotes)
      .where(pageWhere)
      .orderBy(desc(tastingNotes.tastedOn), desc(tastingNotes.id))
      .limit(query.limit + 1),
    db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`${photos.tastingNoteId} IN (
            SELECT ${tastingNotes.id} FROM ${tastingNotes}
            WHERE ${pageWhere}
            ORDER BY ${tastingNotes.tastedOn} DESC, ${tastingNotes.id} DESC
            LIMIT ${query.limit + 1}
          )`,
        ),
      )
      .orderBy(asc(photos.sortOrder), asc(photos.createdAt)),
  ]);
  const { page, hasMore } = takeLimitPlusOne(fetched, query.limit);
  const thumbByNoteId = new Map<string, string>();
  const countByNoteId = new Map<string, number>();
  for (const photo of photoRows) {
    if (!photo.tastingNoteId) {
      continue;
    }
    countByNoteId.set(photo.tastingNoteId, (countByNoteId.get(photo.tastingNoteId) ?? 0) + 1);
    if (!thumbByNoteId.has(photo.tastingNoteId)) {
      thumbByNoteId.set(photo.tastingNoteId, photo.id);
    }
  }

  const last = page.at(-1);
  return {
    items: page.map((row) =>
      toTastingNoteListItem(row, thumbByNoteId.get(row.id) ?? null, countByNoteId.get(row.id) ?? 0),
    ),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    totalCount: Number(totalRow?.n ?? 0),
  };
}

export async function deleteTastingNote(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  noteId: string;
}): Promise<void> {
  const { db, bucket, userId, noteId } = input;
  const [row] = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const photoRows = await db
    .select({ id: photos.id, r2Key: photos.r2Key })
    .from(photos)
    .where(and(eq(photos.tastingNoteId, noteId), eq(photos.userId, userId)));
  for (const photo of photoRows) {
    const scope = and(eq(photos.id, photo.id), eq(photos.userId, userId));
    try {
      await deletePhotoR2Objects(bucket, photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db.update(photos).set({ tastingNoteId: null, updatedAt: new Date() }).where(scope);
    }
  }
  await db
    .delete(tastingNotes)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
}

export async function deleteTastingNoteForLog(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  drinkLogId: string;
}): Promise<void> {
  const current = await loadNoteByDrinkLogId(input.db, input.userId, input.drinkLogId);
  if (!current) {
    return;
  }
  await deleteTastingNote({
    db: input.db,
    bucket: input.bucket,
    userId: input.userId,
    noteId: current.id,
  });
}
