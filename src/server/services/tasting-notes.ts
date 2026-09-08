import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { bottles, photos, tastingNotes } from "@/db/schema.ts";
import { escapeLike } from "@/shared/bottles.ts";
import type { BottleStatus, DrinkType } from "@/shared/constants.ts";
import {
  type CreateTastingNoteInput,
  normalizeNoteText,
  TASTING_NOTE_MESSAGES,
  TASTING_NOTE_PHOTO_MAX,
  type TastingNote,
  type TastingNoteBottle,
  type TastingNoteListItem,
  type TastingNotesQuery,
  type TastingNotesResponse,
  type UpdateTastingNoteInput,
} from "@/shared/tasting-notes.ts";
import { ApiError } from "../errors.ts";
import { requireOwnBottle } from "./bottles.ts";
import { type PhotoBucket, toPhotoMeta } from "./photos.ts";

type NoteRow = typeof tastingNotes.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;
type BottleSnap = { id: string; name: string; drinkType: DrinkType; status: BottleStatus };

function toIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toBottleEmbed(row: BottleSnap | null): TastingNoteBottle {
  if (!row) {
    return null;
  }
  return { id: row.id, name: row.name, status: row.status };
}

export function toTastingNote(
  row: NoteRow,
  photoRows: readonly PhotoRow[],
  bottle: BottleSnap | null,
): TastingNote {
  const metas = photoRows.map(toPhotoMeta);
  return {
    id: row.id,
    drinkName: row.drinkName,
    drinkType: row.drinkType,
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
    drinkName: row.drinkName,
    drinkType: row.drinkType,
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

/** 貯蔵庫の本も選べる。他人・不在は同じ 404。 */

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
    await bucket.delete(photo.r2Key);
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
  const [row] = await db
    .select({
      id: bottles.id,
      name: bottles.name,
      drinkType: bottles.drinkType,
      status: bottles.status,
    })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  return row ?? null;
}

export async function createTastingNote(input: {
  db: AppBatchDb;
  userId: string;
  body: CreateTastingNoteInput;
  now?: Date;
}): Promise<TastingNote> {
  const { db, userId, body } = input;
  const now = input.now ?? new Date();

  let drinkName = body.drinkName ?? "";
  let drinkType = body.drinkType;
  let bottle: BottleSnap | null = null;
  const bottleId = body.bottleId ?? null;
  if (bottleId) {
    bottle = await requireOwnBottle(db, userId, bottleId);
    drinkName = bottle.name;
    drinkType = bottle.drinkType;
  }
  if (!drinkType || drinkName.length === 0) {
    throw new ApiError("validation_error", {
      fields: {
        ...(drinkName.length === 0 ? { drinkName: [TASTING_NOTE_MESSAGES.drinkName] } : {}),
        ...(!drinkType ? { drinkType: [TASTING_NOTE_MESSAGES.drinkType] } : {}),
      },
    });
  }

  const photoRows = await resolveUnattachedPhotos(db, userId, body.photoIds ?? []);
  const id = crypto.randomUUID();
  const row: NoteRow = {
    id,
    userId,
    bottleId,
    drinkName,
    drinkType,
    tastedOn: body.tastedOn,
    appearance: normalizeNoteText(body.appearance),
    aroma: normalizeNoteText(body.aroma),
    taste: normalizeNoteText(body.taste),
    finish: normalizeNoteText(body.finish),
    ratingX10: body.ratingX10,
    createdAt: now,
    updatedAt: now,
  };

  const insert = db.insert(tastingNotes).values(row);
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

  return toTastingNote(
    row,
    photoRows.map((photo, index) => ({
      ...photo,
      tastingNoteId: id,
      sortOrder: index,
      updatedAt: now,
    })),
    bottle,
  );
}

export async function getOwnTastingNote(
  db: AppBatchDb,
  userId: string,
  noteId: string,
): Promise<TastingNote> {
  const [row] = await db
    .select()
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const [photoRows, bottle] = await Promise.all([
    loadNotePhotos(db, userId, noteId),
    loadBottleForNote(db, userId, row.bottleId),
  ]);
  return toTastingNote(row, photoRows, bottle);
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
  const totalRows = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(and(...scope));

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

  const rows = await db
    .select()
    .from(tastingNotes)
    .where(and(...filters))
    .orderBy(desc(tastingNotes.tastedOn), desc(tastingNotes.id));

  let start = 0;
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const cursorIndex = rows.findIndex(
      (row) => row.id === cursor.id && row.tastedOn === cursor.tastedOn,
    );
    if (cursorIndex < 0) {
      throw cursorError();
    }
    start = cursorIndex + 1;
  }

  const page = rows.slice(start, start + query.limit);
  const pageIds = page.map((row) => row.id);
  const photoRows =
    pageIds.length === 0
      ? []
      : await db
          .select()
          .from(photos)
          .where(and(inArray(photos.tastingNoteId, pageIds), eq(photos.userId, userId)))
          .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
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
    nextCursor: start + page.length < rows.length && last ? encodeCursor(last) : null,
    totalCount: totalRows.length,
  };
}

export async function updateTastingNote(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  noteId: string;
  body: UpdateTastingNoteInput;
  now?: Date;
}): Promise<TastingNote> {
  const { db, bucket, userId, noteId, body } = input;
  const [current] = await db
    .select()
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
  if (!current) {
    throw new ApiError("not_found");
  }

  let drinkName = current.drinkName;
  let drinkType = current.drinkType;
  let bottleId = current.bottleId;
  if (body.bottleId) {
    const bottle = await requireOwnBottle(db, userId, body.bottleId);
    drinkName = bottle.name;
    drinkType = bottle.drinkType;
    bottleId = bottle.id;
  } else if (body.bottleId === null) {
    bottleId = null;
    if (!body.drinkName || !body.drinkType) {
      throw new ApiError("validation_error", {
        fields: {
          ...(!body.drinkName ? { drinkName: [TASTING_NOTE_MESSAGES.drinkName] } : {}),
          ...(!body.drinkType ? { drinkType: [TASTING_NOTE_MESSAGES.drinkType] } : {}),
        },
      });
    }
    drinkName = body.drinkName;
    drinkType = body.drinkType;
  } else {
    if (body.drinkName !== undefined && current.bottleId === null) {
      drinkName = body.drinkName;
    }
    if (body.drinkType !== undefined && current.bottleId === null) {
      drinkType = body.drinkType;
    }
  }

  const desiredPhotoRows =
    body.photoIds === undefined
      ? undefined
      : await resolvePatchPhotos(db, userId, noteId, body.photoIds);
  const currentPhotoRows =
    body.photoIds === undefined ? [] : await loadNotePhotos(db, userId, noteId);
  const desiredIds = new Set(desiredPhotoRows?.map((photo) => photo.id) ?? []);
  const removedPhotoRows = currentPhotoRows.filter((photo) => !desiredIds.has(photo.id));
  const updatedAt = input.now ?? new Date();

  const patch = {
    ...(body.tastedOn === undefined ? {} : { tastedOn: body.tastedOn }),
    ...(body.ratingX10 === undefined ? {} : { ratingX10: body.ratingX10 }),
    ...(body.appearance === undefined ? {} : { appearance: normalizeNoteText(body.appearance) }),
    ...(body.aroma === undefined ? {} : { aroma: normalizeNoteText(body.aroma) }),
    ...(body.taste === undefined ? {} : { taste: normalizeNoteText(body.taste) }),
    ...(body.finish === undefined ? {} : { finish: normalizeNoteText(body.finish) }),
    ...(body.bottleId === undefined &&
    drinkName === current.drinkName &&
    drinkType === current.drinkType
      ? {}
      : { bottleId, drinkName, drinkType }),
    updatedAt,
  };

  const updateStatement = db
    .update(tastingNotes)
    .set(patch)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
  const detachStatement =
    removedPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ tastingNoteId: null, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                removedPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              eq(photos.tastingNoteId, noteId),
            ),
          )
      : null;
  const attachStatements =
    desiredPhotoRows?.map((photo, index) =>
      db
        .update(photos)
        .set({ tastingNoteId: noteId, sortOrder: index, updatedAt })
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

  if (desiredPhotoRows !== undefined) {
    await Promise.all(
      removedPhotoRows.map((photo) => removeDetachedPhoto(db, bucket, userId, photo)),
    );
  }

  return getOwnTastingNote(db, userId, noteId);
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
      await bucket.delete(photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db.update(photos).set({ tastingNoteId: null, updatedAt: new Date() }).where(scope);
    }
  }
  await db
    .delete(tastingNotes)
    .where(and(eq(tastingNotes.id, noteId), eq(tastingNotes.userId, userId)));
}
