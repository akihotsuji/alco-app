import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { bottles, drinkLogs, myDrinks, photos } from "@/db/schema.ts";
import { calculateAlcoholGrams, isDryDay, sumAlcoholGrams } from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";
import {
  type CreateDrinkLogInput,
  DRINK_LOG_PHOTO_MAX,
  type DrinkLog,
  type DrinkLogSummary,
  type DrinkLogSummaryQuery,
  normalizeMemo,
} from "@/shared/drink-logs.ts";
import {
  addCalendarDays,
  isoWeekDates,
  parseCalendarDate,
  TOKYO_TIME_ZONE,
  tokyoToday,
} from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
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
    volumeMl: row.volumeMl,
    abvPercent: row.abvPercent,
    alcoholG: row.alcoholG,
    memo: row.memo,
    myDrinkId: row.myDrinkId,
    bottleId: row.bottleId,
    thumbPhotoId: metas[0]?.id ?? null,
    photos: metas,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
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
  const [row] = await db
    .select({ id: bottles.id, name: bottles.name, drinkType: bottles.drinkType })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
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
  let drinkName: string | null = null;

  const myDrinkId = body.myDrinkId ?? null;
  if (myDrinkId) {
    drinkName = (await resolveMyDrink(db, userId, myDrinkId)).name;
  }

  const bottleId = body.bottleId ?? null;
  if (bottleId) {
    // ボトル紐付きは種類と名前をボトルで上書き。量・度数はリクエストが正（api-design 4.3）
    const bottle = await resolveBottle(db, userId, bottleId);
    drinkType = bottle.drinkType;
    drinkName = bottle.name;
  }

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
    volumeMl: body.volumeMl,
    abvPercent: body.abvPercent,
    alcoholG: calculateAlcoholGrams(body.volumeMl, body.abvPercent),
    memo: normalizeMemo(body.memo),
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
}): Promise<{ deletedCount: number; remainingCount: number }> {
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
  // #region agent log
  const deleted = await db
    .delete(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)))
    .returning({ id: drinkLogs.id });
  const remaining = await db
    .select({ id: drinkLogs.id })
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, logId), eq(drinkLogs.userId, userId)));
  // #endregion
  return { deletedCount: deleted.length, remainingCount: remaining.length };
}
