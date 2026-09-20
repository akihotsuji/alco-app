import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { cellarMembers, drinkLogs, myDrinks, photos } from "@/db/schema.ts";
import { calculateAlcoholGrams, isDryDay, sumAlcoholGrams } from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";
import {
  type CreateDrinkLogInput,
  DRINK_LOG_MESSAGES,
  DRINK_LOG_PHOTO_MAX,
  type DrinkLog,
  type DrinkLogItem,
  type DrinkLogSummary,
  type DrinkLogSummaryQuery,
  type DrinkLogsQuery,
  type DrinkLogsResponse,
  normalizeMemo,
  type UpdateDrinkLogInput,
} from "@/shared/drink-logs.ts";
import { normalizeOptionalText, resolveIdentityFields } from "@/shared/identity.ts";
import type { TastingNoteEmbedded, TastingNoteSummary } from "@/shared/tasting-notes.ts";
import {
  addCalendarDays,
  isoWeekDates,
  parseCalendarDate,
  TOKYO_TIME_ZONE,
  tokyoToday,
} from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
import { takeLimitPlusOne } from "../lib/keyset-page.ts";
import { photosRemovedByPatch } from "../lib/photo-patch.ts";
import { requireOwnBottle } from "./bottles.ts";
import { writtenOrigin } from "./origin-write.ts";
import {
  assertPhotoDailyLimit,
  duplicatePhotoObject,
  type PhotoBucket,
  toPhotoMeta,
} from "./photos.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";
import {
  deleteTastingNoteForLog,
  loadEmbeddedTastingNote,
  loadTastingNoteSummaries,
  syncTastingNoteIdentityFromLog,
  upsertTastingNoteForLog,
} from "./tasting-notes.ts";

type DrinkLogRow = typeof drinkLogs.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

function toIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toDrinkLog(
  row: DrinkLogRow,
  photoRows: readonly PhotoRow[],
  tastingNote: TastingNoteEmbedded | null = null,
): DrinkLog {
  const metas = photoRows.map(toPhotoMeta);
  return {
    id: row.id,
    drunkAt: toIso(row.drunkAt),
    drunkOn: row.drunkOn,
    drinkType: row.drinkType,
    drinkName: row.drinkName,
    producer: row.producer,
    origin: row.origin,
    variety: row.variety,
    vintage: row.vintage,
    volumeMl: row.volumeMl,
    abvPercent: row.abvPercent,
    alcoholG: row.alcoholG,
    memo: row.memo,
    placeName: row.placeName,
    placeLat: row.placeLat,
    placeLng: row.placeLng,
    myDrinkId: row.myDrinkId,
    bottleId: row.bottleId,
    thumbPhotoId: metas[0]?.id ?? null,
    photos: metas,
    tastingNote,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toDrinkLogItem(
  row: DrinkLogRow,
  thumbPhotoId: string | null,
  tastingNote: TastingNoteSummary | null = null,
): DrinkLogItem {
  return {
    id: row.id,
    drunkAt: toIso(row.drunkAt),
    drunkOn: row.drunkOn,
    drinkType: row.drinkType,
    drinkName: row.drinkName,
    producer: row.producer,
    origin: row.origin,
    variety: row.variety,
    vintage: row.vintage,
    volumeMl: row.volumeMl,
    abvPercent: row.abvPercent,
    alcoholG: row.alcoholG,
    memo: row.memo,
    placeName: row.placeName,
    placeLat: row.placeLat,
    placeLng: row.placeLng,
    myDrinkId: row.myDrinkId,
    bottleId: row.bottleId,
    thumbPhotoId,
    tastingNote,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

const drinkLogCursorSchema = z
  .object({
    id: z.string().uuid(),
    drunkAt: z.number().int(),
  })
  .strict();

function cursorError(): ApiError {
  return new ApiError("validation_error", {
    fields: { cursor: [DRINK_LOG_MESSAGES.cursor] },
  });
}

function encodeCursor(row: DrinkLogRow): string {
  return btoa(JSON.stringify({ id: row.id, drunkAt: row.drunkAt.getTime() }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeCursor(cursor: string): z.infer<typeof drinkLogCursorSchema> {
  try {
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    const parsed = drinkLogCursorSchema.safeParse(payload);
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

/** 他人・不在は同じ 404（存在を漏らさない）。値はコピー用に返す。 */
async function resolveMyDrink(db: AppBatchDb, userId: string, myDrinkId: string) {
  const [row] = await db
    .select({ id: myDrinks.id, name: myDrinks.name })
    .from(myDrinks)
    .where(and(eq(myDrinks.id, myDrinkId), eq(myDrinks.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

/** 貯蔵庫（consumed）の本も選べる。status では絞らない。 */
async function resolveBottle(db: AppBatchDb, userId: string, bottleId: string) {
  return requireOwnBottle(db, userId, bottleId);
}

type ResolvedDrinkLogPhoto = {
  attach: PhotoRow | null;
  copy: PhotoRow | null;
};

/**
 * 未紐付けの自分の写真、または参照可能なボトル写真。
 * ボトル写真は所有排他のため複製してから記録へ付ける。他人・ノート等へ紐付け済み・不明は 404。
 */
async function resolveDrinkLogPhoto(
  db: AppBatchDb,
  userId: string,
  photoIds: readonly string[],
  currentLogId?: string,
): Promise<ResolvedDrinkLogPhoto> {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) {
    return { attach: null, copy: null };
  }
  if (unique.length !== photoIds.length || unique.length > DRINK_LOG_PHOTO_MAX) {
    throw new ApiError("not_found");
  }
  const personalOwner = currentLogId
    ? or(isNull(photos.drinkLogId), eq(photos.drinkLogId, currentLogId))
    : isNull(photos.drinkLogId);
  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        inArray(photos.id, unique),
        or(
          and(
            eq(photos.userId, userId),
            isNull(photos.cellarId),
            isNull(photos.bottleId),
            isNull(photos.tastingNoteId),
            personalOwner,
          ),
          and(
            isNull(photos.userId),
            isNotNull(photos.bottleId),
            sql`${photos.cellarId} IN (SELECT ${cellarMembers.cellarId} FROM ${cellarMembers} WHERE ${cellarMembers.userId} = ${userId})`,
          ),
        ),
      ),
    );
  if (rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  const row = rows[0];
  if (!row) {
    return { attach: null, copy: null };
  }
  if (row.bottleId) {
    return { attach: null, copy: row };
  }
  return { attach: row, copy: null };
}

async function copyBottlePhotoForLog(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  source: PhotoRow;
  drinkLogId: string;
  now: Date;
}): Promise<PhotoRow> {
  await assertPhotoDailyLimit({
    db: input.db,
    userId: input.userId,
    now: input.now,
  });
  const duplicated = await duplicatePhotoObject(input.bucket, input.source);
  return {
    id: duplicated.id,
    userId: input.userId,
    cellarId: null,
    uploadedBy: input.userId,
    r2Key: duplicated.r2Key,
    contentType: duplicated.contentType,
    byteSize: duplicated.byteSize,
    width: duplicated.width,
    height: duplicated.height,
    bottleId: null,
    tastingNoteId: null,
    drinkLogId: input.drinkLogId,
    kind: duplicated.kind,
    sortOrder: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export async function createDrinkLog(input: {
  db: AppBatchDb;
  bucket?: PhotoBucket;
  userId: string;
  body: CreateDrinkLogInput;
  now?: Date;
}): Promise<DrinkLog> {
  const { db, userId, body } = input;
  const now = input.now ?? new Date();

  let drinkType: DrinkType = body.drinkType;
  let drinkName: string | null = normalizeOptionalText(body.drinkName);
  let bottleSnap: Awaited<ReturnType<typeof resolveBottle>> | null = null;

  const myDrinkId = body.myDrinkId ?? null;
  if (myDrinkId && body.drinkName === undefined) {
    drinkName = (await resolveMyDrink(db, userId, myDrinkId)).name;
  } else if (myDrinkId) {
    await resolveMyDrink(db, userId, myDrinkId);
  }

  const bottleId = body.bottleId ?? null;
  if (bottleId) {
    bottleSnap = await resolveBottle(db, userId, bottleId);
    if (body.drinkName === undefined) {
      drinkName = bottleSnap.name;
    }
    if (body.drinkType === undefined) {
      drinkType = bottleSnap.drinkType;
    }
  }

  const identity = resolveIdentityFields(body, bottleSnap);
  const originWrite = writtenOrigin(body.origin, bottleSnap?.origin);
  if (originWrite !== undefined) {
    identity.origin = originWrite;
  }
  const resolved = await resolveDrinkLogPhoto(db, userId, body.photoIds ?? []);

  const drunkAt = body.drunkAt ? new Date(body.drunkAt) : now;
  const id = crypto.randomUUID();
  const row: DrinkLogRow = {
    id,
    userId,
    drunkAt,
    drunkOn: tokyoToday(drunkAt),
    drinkType,
    drinkName,
    producer: identity.producer,
    origin: identity.origin,
    variety: identity.variety,
    vintage: identity.vintage,
    volumeMl: body.volumeMl,
    abvPercent: body.abvPercent,
    alcoholG: calculateAlcoholGrams(body.volumeMl, body.abvPercent),
    memo: normalizeMemo(body.memo),
    placeName: normalizeOptionalText(body.placeName),
    placeLat: body.placeLat ?? null,
    placeLng: body.placeLng ?? null,
    myDrinkId,
    bottleId,
    createdAt: now,
    updatedAt: now,
  };

  const insert = db.insert(drinkLogs).values(row);
  let resultPhotos: PhotoRow[] = [];
  let copied: PhotoRow | null = null;
  if (resolved.copy) {
    const bucket = input.bucket;
    if (!bucket) {
      throw new ApiError("internal_error");
    }
    try {
      copied = await copyBottlePhotoForLog({
        db,
        bucket,
        userId,
        source: resolved.copy,
        drinkLogId: id,
        now,
      });
      await db.batch([insert, db.insert(photos).values(copied)]);
      resultPhotos = [copied];
    } catch (error) {
      if (copied) {
        await deletePhotoR2Objects(bucket, copied.r2Key).catch(() => undefined);
      }
      throw error;
    }
  } else if (resolved.attach) {
    const photoIds = [resolved.attach.id];
    await db.batch([
      insert,
      db
        .update(photos)
        .set({ drinkLogId: id, updatedAt: now })
        .where(
          and(inArray(photos.id, photoIds), eq(photos.userId, userId), isNull(photos.drinkLogId)),
        ),
    ]);
    resultPhotos = [{ ...resolved.attach, drinkLogId: id, updatedAt: now }];
  } else {
    await insert;
  }

  let tastingNote = null;
  if (body.tastingNote) {
    await upsertTastingNoteForLog({
      db,
      bucket: input.bucket,
      userId,
      log: row,
      body: body.tastingNote,
      now,
    });
    tastingNote = await loadEmbeddedTastingNote(db, userId, row.id);
  }

  return toDrinkLog(row, resultPhotos, tastingNote);
}

export async function getOwnDrinkLog(
  db: AppBatchDb,
  userId: string,
  logId: string,
): Promise<DrinkLog> {
  const [row] = await db
    .select()
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const [photoRows, tastingNote] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)))
      .orderBy(asc(photos.sortOrder), asc(photos.createdAt)),
    loadEmbeddedTastingNote(db, userId, logId),
  ]);
  return toDrinkLog(row, photoRows, tastingNote);
}

export async function listDrinkLogs(input: {
  db: AppBatchDb;
  userId: string;
  query: DrinkLogsQuery;
}): Promise<DrinkLogsResponse> {
  const { db, userId, query } = input;
  if (query.bottleId) {
    await resolveBottle(db, userId, query.bottleId);
  }

  const filterConditions = [eq(drinkLogs.userId, userId)];
  if (query.date) {
    filterConditions.push(eq(drinkLogs.drunkOn, query.date));
  } else {
    if (query.from) {
      filterConditions.push(gte(drinkLogs.drunkOn, query.from));
    }
    if (query.to) {
      filterConditions.push(lte(drinkLogs.drunkOn, query.to));
    }
  }
  if (query.bottleId) {
    filterConditions.push(eq(drinkLogs.bottleId, query.bottleId));
  }

  const pageConditions = [...filterConditions];
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const [anchor] = await db
      .select({ id: drinkLogs.id, drunkAt: drinkLogs.drunkAt })
      .from(drinkLogs)
      .where(and(eq(drinkLogs.id, cursor.id), eq(drinkLogs.userId, userId)));
    if (!anchor || anchor.drunkAt.getTime() !== cursor.drunkAt) {
      throw cursorError();
    }
    pageConditions.push(
      sql`(${drinkLogs.drunkAt} < ${cursor.drunkAt} or (${drinkLogs.drunkAt} = ${cursor.drunkAt} and ${drinkLogs.id} < ${cursor.id}))`,
    );
  }

  const pageWhere = and(...pageConditions);
  const filteredBeyondUser = Boolean(query.date || query.from || query.to || query.bottleId);
  const [agg, fetched, photoRows, anyLog] = await Promise.all([
    db
      .select({
        n: count(),
        alcohol: sql<number>`coalesce(sum(${drinkLogs.alcoholG}), 0)`,
      })
      .from(drinkLogs)
      .where(and(...filterConditions))
      .then((rows) => rows[0]),
    db
      .select()
      .from(drinkLogs)
      .where(pageWhere)
      .orderBy(desc(drinkLogs.drunkAt), desc(drinkLogs.id))
      .limit(query.limit + 1),
    db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`${photos.drinkLogId} IN (
            SELECT ${drinkLogs.id} FROM ${drinkLogs}
            WHERE ${pageWhere}
            ORDER BY ${drinkLogs.drunkAt} DESC, ${drinkLogs.id} DESC
            LIMIT ${query.limit + 1}
          )`,
        ),
      )
      .orderBy(asc(photos.sortOrder), asc(photos.createdAt)),
    filteredBeyondUser
      ? db
          .select({ id: drinkLogs.id })
          .from(drinkLogs)
          .where(eq(drinkLogs.userId, userId))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);
  const { page, hasMore } = takeLimitPlusOne(fetched, query.limit);
  const thumbByLogId = new Map<string, string>();
  for (const photo of photoRows) {
    if (photo.drinkLogId && !thumbByLogId.has(photo.drinkLogId)) {
      thumbByLogId.set(photo.drinkLogId, photo.id);
    }
  }

  const last = page.at(-1);
  const totalCount = Number(agg?.n ?? 0);
  const noteSummaries = await loadTastingNoteSummaries(
    db,
    userId,
    page.map((row) => row.id),
  );
  return {
    items: page.map((row) =>
      toDrinkLogItem(row, thumbByLogId.get(row.id) ?? null, noteSummaries.get(row.id) ?? null),
    ),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    totalCount,
    totalAlcoholG: sumAlcoholGrams([Number(agg?.alcohol ?? 0)]),
    hasAnyLogs: filteredBeyondUser ? anyLog !== undefined : totalCount > 0,
  };
}

async function resolvePatchPhotos(
  db: AppBatchDb,
  userId: string,
  logId: string,
  photoIds: readonly string[],
): Promise<ResolvedDrinkLogPhoto> {
  return resolveDrinkLogPhoto(db, userId, photoIds, logId);
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
      .where(and(eq(photos.id, photo.id), eq(photos.userId, userId), isNull(photos.drinkLogId)));
  } catch {
    // 未紐付けのまま残し、24h 後の日次 GC に再試行させる。
  }
}

export async function updateDrinkLog(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  logId: string;
  body: UpdateDrinkLogInput;
  now?: Date;
}): Promise<DrinkLog> {
  const { db, bucket, userId, logId, body } = input;
  const [current] = await db
    .select()
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  if (!current) {
    throw new ApiError("not_found");
  }

  let drinkName = current.drinkName;
  let drinkType = body.drinkType ?? current.drinkType;
  if (body.drinkName !== undefined) {
    drinkName = normalizeOptionalText(body.drinkName);
  }
  if (body.myDrinkId) {
    const preset = await resolveMyDrink(db, userId, body.myDrinkId);
    if (body.bottleId === null || (body.bottleId === undefined && current.bottleId === null)) {
      drinkName = preset.name;
    }
  }
  let bottleSnap: Awaited<ReturnType<typeof resolveBottle>> | null = null;
  if (body.bottleId) {
    bottleSnap = await resolveBottle(db, userId, body.bottleId);
    if (body.drinkName === undefined) {
      drinkName = bottleSnap.name;
    }
    if (body.drinkType === undefined) {
      drinkType = bottleSnap.drinkType;
    }
  }
  const identityFallback = bottleSnap ?? {
    producer: current.producer,
    origin: current.origin,
    variety: current.variety,
    vintage: current.vintage,
  };
  const identity = resolveIdentityFields(body, identityFallback);
  const originWrite = writtenOrigin(body.origin, current.origin);
  if (originWrite !== undefined) {
    identity.origin = originWrite;
  }

  const currentPhotoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  const drunkAt = body.drunkAt ? new Date(body.drunkAt) : current.drunkAt;
  const volumeMl = body.volumeMl ?? current.volumeMl;
  const abvPercent = body.abvPercent ?? current.abvPercent;
  const updatedAt = input.now ?? new Date();
  const resolvedPhotos =
    body.photoIds === undefined
      ? undefined
      : await resolvePatchPhotos(db, userId, logId, body.photoIds);
  let copiedPhoto: PhotoRow | null = null;
  if (resolvedPhotos?.copy) {
    copiedPhoto = await copyBottlePhotoForLog({
      db,
      bucket,
      userId,
      source: resolvedPhotos.copy,
      drinkLogId: logId,
      now: updatedAt,
    });
  }
  const desiredPhotoRows =
    resolvedPhotos === undefined
      ? undefined
      : copiedPhoto
        ? [copiedPhoto]
        : resolvedPhotos.attach
          ? [resolvedPhotos.attach]
          : [];
  const removedPhotoRows = photosRemovedByPatch(currentPhotoRows, desiredPhotoRows);
  const patch = {
    ...(body.drunkAt === undefined ? {} : { drunkAt, drunkOn: tokyoToday(drunkAt) }),
    ...(body.volumeMl === undefined ? {} : { volumeMl }),
    ...(body.abvPercent === undefined ? {} : { abvPercent }),
    ...(body.volumeMl === undefined && body.abvPercent === undefined
      ? {}
      : { alcoholG: calculateAlcoholGrams(volumeMl, abvPercent) }),
    ...(body.drinkType === undefined && !body.bottleId ? {} : { drinkType }),
    ...(body.memo === undefined ? {} : { memo: normalizeMemo(body.memo) }),
    ...(body.myDrinkId === undefined ? {} : { myDrinkId: body.myDrinkId }),
    ...(body.bottleId === undefined ? {} : { bottleId: body.bottleId }),
    ...(drinkName === current.drinkName ? {} : { drinkName }),
    ...(body.producer === undefined && !bottleSnap ? {} : { producer: identity.producer }),
    ...(body.origin === undefined && !bottleSnap ? {} : { origin: identity.origin }),
    ...(body.variety === undefined && !bottleSnap ? {} : { variety: identity.variety }),
    ...(body.vintage === undefined && !bottleSnap ? {} : { vintage: identity.vintage }),
    ...(body.placeName === undefined ? {} : { placeName: normalizeOptionalText(body.placeName) }),
    ...(body.placeLat === undefined ? {} : { placeLat: body.placeLat }),
    ...(body.placeLng === undefined ? {} : { placeLng: body.placeLng }),
    updatedAt,
  };

  const updateStatement = db
    .update(drinkLogs)
    .set(patch)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  const detachStatement =
    removedPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ drinkLogId: null, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                removedPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              eq(photos.drinkLogId, logId),
            ),
          )
      : null;
  const attachStatement =
    desiredPhotoRows && desiredPhotoRows.length > 0 && !copiedPhoto
      ? db
          .update(photos)
          .set({ drinkLogId: logId, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                desiredPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              isNull(photos.bottleId),
              isNull(photos.tastingNoteId),
            ),
          )
      : null;
  const insertCopyStatement = copiedPhoto ? db.insert(photos).values(copiedPhoto) : null;

  try {
    if (detachStatement && insertCopyStatement) {
      await db.batch([updateStatement, detachStatement, insertCopyStatement]);
    } else if (insertCopyStatement) {
      await db.batch([updateStatement, insertCopyStatement]);
    } else if (detachStatement && attachStatement) {
      await db.batch([updateStatement, detachStatement, attachStatement]);
    } else if (detachStatement) {
      await db.batch([updateStatement, detachStatement]);
    } else if (attachStatement) {
      await db.batch([updateStatement, attachStatement]);
    } else {
      await updateStatement;
    }
  } catch (error) {
    if (copiedPhoto) {
      await deletePhotoR2Objects(bucket, copiedPhoto.r2Key).catch(() => undefined);
    }
    throw error;
  }

  if (desiredPhotoRows !== undefined) {
    await Promise.all(
      removedPhotoRows.map((photo) => removeDetachedPhoto(db, bucket, userId, photo)),
    );
  }

  const row: DrinkLogRow = { ...current, ...patch };
  const finalPhotos =
    desiredPhotoRows === undefined
      ? currentPhotoRows
      : desiredPhotoRows.map((photo) => ({ ...photo, drinkLogId: logId, updatedAt }));

  if (body.tastingNote === null) {
    await deleteTastingNoteForLog({ db, bucket, userId, drinkLogId: logId });
  } else if (body.tastingNote) {
    await upsertTastingNoteForLog({
      db,
      bucket,
      userId,
      log: row,
      body: body.tastingNote,
      now: updatedAt,
    });
  } else {
    await syncTastingNoteIdentityFromLog({ db, userId, log: row, now: updatedAt });
  }

  const tastingNote = await loadEmbeddedTastingNote(db, userId, logId);
  return toDrinkLog(row, finalPhotos, tastingNote);
}

function datesForSummary(query: DrinkLogSummaryQuery): string[] {
  if (query.period === "day") {
    return [query.date];
  }
  if (query.period === "week") {
    return isoWeekDates(query.date);
  }
  const anchor = parseCalendarDate(query.date);
  if (!anchor) {
    throw new ApiError("validation_error");
  }
  const first = `${anchor.year}-${String(anchor.month).padStart(2, "0")}-01`;
  const dates: string[] = [];
  let date = first;
  while (parseCalendarDate(date)?.month === anchor.month) {
    dates.push(date);
    date = addCalendarDays(date, 1);
  }
  return dates;
}

export async function getDrinkLogSummary(input: {
  db: AppBatchDb;
  userId: string;
  query: DrinkLogSummaryQuery;
  now?: Date;
}): Promise<DrinkLogSummary> {
  const dates = datesForSummary(input.query);
  const from = dates[0];
  const to = dates.at(-1);
  if (!from || !to) {
    throw new ApiError("internal_error");
  }

  const grouped = await input.db
    .select({
      drunkOn: drinkLogs.drunkOn,
      n: count(),
      alcohol: sql<number>`coalesce(sum(${drinkLogs.alcoholG}), 0)`,
    })
    .from(drinkLogs)
    .where(
      and(
        eq(drinkLogs.userId, input.userId),
        gte(drinkLogs.drunkOn, from),
        lte(drinkLogs.drunkOn, to),
      ),
    )
    .groupBy(drinkLogs.drunkOn);

  const rowsByDate = new Map<string, { count: number; alcoholG: number }>();
  for (const row of grouped) {
    rowsByDate.set(row.drunkOn, {
      count: Number(row.n),
      alcoholG: Number(row.alcohol),
    });
  }

  const today = tokyoToday(input.now);
  const days = dates.map((date) => {
    const agg = rowsByDate.get(date);
    const logCount = agg?.count ?? 0;
    const isFuture = date > today;
    return {
      date,
      count: logCount,
      alcoholG: agg ? sumAlcoholGrams([agg.alcoholG]) : 0,
      isDryDay: isDryDay(logCount, isFuture),
      isFuture,
    };
  });

  return {
    period: input.query.period,
    from,
    to,
    timezone: TOKYO_TIME_ZONE,
    totalCount: grouped.reduce((sum, row) => sum + Number(row.n), 0),
    totalAlcoholG: sumAlcoholGrams(grouped.map((row) => Number(row.alcohol))),
    dryDayCount: days.filter((day) => day.isDryDay).length,
    days,
  };
}

/**
 * 記録と写真（メタ + R2）を消す。R2 の削除に失敗した写真は行を消さずに紐付けだけ外し、
 * 24h 後の日次 GC（未紐付け掃除）に再試行させる。
 */
export async function deleteDrinkLog(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  logId: string;
}): Promise<void> {
  const { db, bucket, userId, logId } = input;
  const [row] = await db
    .select({ id: drinkLogs.id })
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  await deleteTastingNoteForLog({ db, bucket, userId, drinkLogId: logId });
  const photoRows = await db
    .select({ id: photos.id, r2Key: photos.r2Key })
    .from(photos)
    .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)));
  for (const photo of photoRows) {
    const scope = and(eq(photos.id, photo.id), eq(photos.userId, userId));
    try {
      await deletePhotoR2Objects(bucket, photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db.update(photos).set({ drinkLogId: null, updatedAt: new Date() }).where(scope);
    }
  }
  await db.delete(drinkLogs).where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
}
