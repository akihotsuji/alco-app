import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { drinkLogs, myDrinks, photos } from "@/db/schema.ts";
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
import {
  addCalendarDays,
  isoWeekDates,
  parseCalendarDate,
  TOKYO_TIME_ZONE,
  tokyoToday,
} from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
import { requireOwnBottle } from "./bottles.ts";
import { type PhotoBucket, toPhotoMeta } from "./photos.ts";

type DrinkLogRow = typeof drinkLogs.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

function toIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toDrinkLog(row: DrinkLogRow, photoRows: readonly PhotoRow[]): DrinkLog {
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
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toDrinkLogItem(row: DrinkLogRow, thumbPhotoId: string | null): DrinkLogItem {
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

/** 自分の **未紐付け** 写真だけ紐付けられる。他人・紐付け済み・不明はすべて 404。 */
async function resolveUnattachedPhotos(
  db: AppBatchDb,
  userId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) {
    return [];
  }
  if (unique.length > DRINK_LOG_PHOTO_MAX) {
    throw new ApiError("not_found");
  }
  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        inArray(photos.id, unique),
        eq(photos.userId, userId),
        isNull(photos.bottleId),
        isNull(photos.tastingNoteId),
        isNull(photos.drinkLogId),
      ),
    );
  if (rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  return rows;
}

export async function createDrinkLog(input: {
  db: AppBatchDb;
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
  if (myDrinkId) {
    drinkName = (await resolveMyDrink(db, userId, myDrinkId)).name;
  }

  const bottleId = body.bottleId ?? null;
  if (bottleId) {
    // ボトル紐付きは種類と名前をボトルで上書き。量・度数はリクエストが正（api-design 4.3）
    bottleSnap = await resolveBottle(db, userId, bottleId);
    drinkType = bottleSnap.drinkType;
    drinkName = bottleSnap.name;
  }

  const identity = resolveIdentityFields(body, bottleSnap);
  const photoRows = await resolveUnattachedPhotos(db, userId, body.photoIds ?? []);

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
  if (photoRows.length === 0) {
    await insert;
  } else {
    const photoIds = photoRows.map((photo) => photo.id);
    await db.batch([
      insert,
      db
        .update(photos)
        .set({ drinkLogId: id, updatedAt: now })
        .where(
          and(inArray(photos.id, photoIds), eq(photos.userId, userId), isNull(photos.drinkLogId)),
        ),
    ]);
  }

  return toDrinkLog(
    row,
    photoRows.map((photo) => ({ ...photo, drinkLogId: id, updatedAt: now })),
  );
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
  const photoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  return toDrinkLog(row, photoRows);
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

  const conditions = [eq(drinkLogs.userId, userId)];
  if (query.date) {
    conditions.push(eq(drinkLogs.drunkOn, query.date));
  } else {
    if (query.from) {
      conditions.push(gte(drinkLogs.drunkOn, query.from));
    }
    if (query.to) {
      conditions.push(lte(drinkLogs.drunkOn, query.to));
    }
  }
  if (query.bottleId) {
    conditions.push(eq(drinkLogs.bottleId, query.bottleId));
  }

  const rows = await db
    .select()
    .from(drinkLogs)
    .where(and(...conditions))
    .orderBy(desc(drinkLogs.drunkAt), desc(drinkLogs.id));

  let start = 0;
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const cursorIndex = rows.findIndex(
      (row) => row.id === cursor.id && row.drunkAt.getTime() === cursor.drunkAt,
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
          .where(and(inArray(photos.drinkLogId, pageIds), eq(photos.userId, userId)))
          .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  const thumbByLogId = new Map<string, string>();
  for (const photo of photoRows) {
    if (photo.drinkLogId && !thumbByLogId.has(photo.drinkLogId)) {
      thumbByLogId.set(photo.drinkLogId, photo.id);
    }
  }

  const [anyLog] = await db
    .select({ id: drinkLogs.id })
    .from(drinkLogs)
    .where(eq(drinkLogs.userId, userId))
    .limit(1);
  const last = page.at(-1);
  return {
    items: page.map((row) => toDrinkLogItem(row, thumbByLogId.get(row.id) ?? null)),
    nextCursor: start + page.length < rows.length && last ? encodeCursor(last) : null,
    totalCount: rows.length,
    totalAlcoholG: sumAlcoholGrams(rows.map((row) => row.alcoholG)),
    hasAnyLogs: anyLog !== undefined,
  };
}

async function resolvePatchPhotos(
  db: AppBatchDb,
  userId: string,
  logId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  const unique = [...new Set(photoIds)];
  if (unique.length !== photoIds.length || unique.length > DRINK_LOG_PHOTO_MAX) {
    throw new ApiError("not_found");
  }
  if (unique.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(photos)
    .where(and(inArray(photos.id, unique), eq(photos.userId, userId)));
  const valid = rows.every(
    (photo) =>
      photo.bottleId === null &&
      photo.tastingNoteId === null &&
      (photo.drinkLogId === null || photo.drinkLogId === logId),
  );
  if (!valid || rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  return rows;
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
    drinkName = bottleSnap.name;
    drinkType = bottleSnap.drinkType;
  }
  const identity = resolveIdentityFields(
    body,
    bottleSnap ?? {
      producer: current.producer,
      origin: current.origin,
      variety: current.variety,
      vintage: current.vintage,
    },
  );

  const desiredPhotoRows =
    body.photoIds === undefined
      ? undefined
      : await resolvePatchPhotos(db, userId, logId, body.photoIds);
  const currentPhotoRows =
    body.photoIds === undefined
      ? []
      : await db
          .select()
          .from(photos)
          .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)));
  const desiredIds = new Set(desiredPhotoRows?.map((photo) => photo.id) ?? []);
  const removedPhotoRows = currentPhotoRows.filter((photo) => !desiredIds.has(photo.id));

  const drunkAt = body.drunkAt ? new Date(body.drunkAt) : current.drunkAt;
  const volumeMl = body.volumeMl ?? current.volumeMl;
  const abvPercent = body.abvPercent ?? current.abvPercent;
  const updatedAt = input.now ?? new Date();
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
    desiredPhotoRows && desiredPhotoRows.length > 0
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

  if (detachStatement && attachStatement) {
    await db.batch([updateStatement, detachStatement, attachStatement]);
  } else if (detachStatement) {
    await db.batch([updateStatement, detachStatement]);
  } else if (attachStatement) {
    await db.batch([updateStatement, attachStatement]);
  } else {
    await updateStatement;
  }

  if (desiredPhotoRows !== undefined) {
    await Promise.all(
      removedPhotoRows.map((photo) => removeDetachedPhoto(db, bucket, userId, photo)),
    );
  }

  const [row] = await db
    .select()
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const finalPhotos = await db
    .select()
    .from(photos)
    .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)))
    .orderBy(asc(photos.sortOrder), asc(photos.createdAt));
  return toDrinkLog(row, finalPhotos);
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

  const rows = await input.db
    .select({ drunkOn: drinkLogs.drunkOn, alcoholG: drinkLogs.alcoholG })
    .from(drinkLogs)
    .where(
      and(
        eq(drinkLogs.userId, input.userId),
        gte(drinkLogs.drunkOn, from),
        lte(drinkLogs.drunkOn, to),
      ),
    );

  const rowsByDate = new Map<string, number[]>();
  for (const row of rows) {
    const values = rowsByDate.get(row.drunkOn) ?? [];
    values.push(row.alcoholG);
    rowsByDate.set(row.drunkOn, values);
  }

  const today = tokyoToday(input.now);
  const days = dates.map((date) => {
    const alcoholValues = rowsByDate.get(date) ?? [];
    const isFuture = date > today;
    return {
      date,
      count: alcoholValues.length,
      alcoholG: sumAlcoholGrams(alcoholValues),
      isDryDay: isDryDay(alcoholValues.length, isFuture),
      isFuture,
    };
  });

  return {
    period: input.query.period,
    from,
    to,
    timezone: TOKYO_TIME_ZONE,
    totalCount: rows.length,
    totalAlcoholG: sumAlcoholGrams(rows.map((row) => row.alcoholG)),
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
  const photoRows = await db
    .select({ id: photos.id, r2Key: photos.r2Key })
    .from(photos)
    .where(and(eq(photos.drinkLogId, logId), eq(photos.userId, userId)));
  for (const photo of photoRows) {
    const scope = and(eq(photos.id, photo.id), eq(photos.userId, userId));
    try {
      await bucket.delete(photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db.update(photos).set({ drinkLogId: null, updatedAt: new Date() }).where(scope);
    }
  }
  await db.delete(drinkLogs).where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
}
