import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { bottles, photos } from "@/db/schema.ts";
import {
  BOTTLE_MESSAGES,
  BOTTLE_PHOTO_MAX,
  type Bottle,
  type BottleItem,
  type BottlesQuery,
  type BottlesResponse,
  type BottleView,
  type CountsByType,
  type CreateBottleInput,
  DEFAULT_BOTTLE_STORAGE,
  emptyCountsByType,
  escapeLike,
  normalizeOptionalText,
  type UpdateBottleInput,
} from "@/shared/bottles.ts";
import type { BottleStatus, DrinkType, PhotoContentType, PhotoKind } from "@/shared/constants.ts";
import { DEFAULT_BOTTLE_STATUS, PHOTO_CONTENT_TYPES } from "@/shared/constants.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { takeLimitPlusOne } from "../lib/keyset-page.ts";
import { ApiError } from "../errors.ts";
import { type PhotoBucket, toPhotoMeta } from "./photos.ts";
import { writtenOrigin } from "./origin-write.ts";

type BottleRow = typeof bottles.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

function toIso(value: Date | number | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requireIso(value: Date | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asContentType(value: string): PhotoContentType {
  for (const allowed of PHOTO_CONTENT_TYPES) {
    if (value === allowed) {
      return allowed;
    }
  }
  return "image/jpeg";
}

function extensionFromR2Key(r2Key: string): string {
  const dot = r2Key.lastIndexOf(".");
  return dot >= 0 ? r2Key.slice(dot + 1) : "jpg";
}

function thumbOf(photoRows: readonly PhotoRow[]): {
  thumbPhotoId: string | null;
  thumbPhotoKind: PhotoKind | null;
} {
  const first = photoRows[0];
  return {
    thumbPhotoId: first?.id ?? null,
    thumbPhotoKind: first?.kind ?? null,
  };
}

export function toBottle(row: BottleRow, photoRows: readonly PhotoRow[]): Bottle {
  const thumb = thumbOf(photoRows);
  return {
    id: row.id,
    name: row.name,
    drinkType: row.drinkType,
    producer: row.producer,
    origin: row.origin,
    variety: row.variety,
    vintage: row.vintage,
    purchasedOn: row.purchasedOn,
    priceJpy: row.priceJpy,
    shop: row.shop,
    storedOn: row.storedOn,
    storage: row.storage,
    memo: row.memo,
    status: row.status,
    consumedAt: toIso(row.consumedAt),
    consumedOn: row.consumedOn,
    thumbPhotoId: thumb.thumbPhotoId,
    thumbPhotoKind: thumb.thumbPhotoKind,
    photos: photoRows.map(toPhotoMeta),
    createdAt: requireIso(row.createdAt),
    updatedAt: requireIso(row.updatedAt),
  };
}

export function toBottleItem(row: BottleRow, photoRows: readonly PhotoRow[]): BottleItem {
  const { photos: _photos, ...item } = toBottle(row, photoRows);
  return item;
}

const bottleCursorSchema = z
  .object({
    id: z.string().uuid(),
    at: z.number().int(),
  })
  .strict();

function cursorError(): ApiError {
  return new ApiError("validation_error", {
    fields: { cursor: [BOTTLE_MESSAGES.cursor] },
  });
}

function sortAt(row: BottleRow, view: BottleView): number {
  if (view === "archive") {
    return row.consumedAt?.getTime() ?? 0;
  }
  return row.createdAt.getTime();
}

function encodeCursor(row: BottleRow, view: BottleView): string {
  return btoa(JSON.stringify({ id: row.id, at: sortAt(row, view) }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeCursor(cursor: string): z.infer<typeof bottleCursorSchema> {
  try {
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    const parsed = bottleCursorSchema.safeParse(payload);
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

function viewStatus(view: BottleView): "sealed" | "consumed" | null {
  if (view === "cellar") {
    return "sealed";
  }
  if (view === "archive") {
    return "consumed";
  }
  return null;
}

/** 自分の未紐付け写真だけ紐付けられる。他人・紐付け済み・不明はすべて 404。 */
async function resolveUnattachedPhotos(
  db: AppBatchDb,
  userId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) {
    return [];
  }
  if (unique.length > BOTTLE_PHOTO_MAX) {
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

async function resolvePatchPhotos(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  const unique = [...new Set(photoIds)];
  if (unique.length !== photoIds.length || unique.length > BOTTLE_PHOTO_MAX) {
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
      photo.tastingNoteId === null &&
      photo.drinkLogId === null &&
      (photo.bottleId === null || photo.bottleId === bottleId),
  );
  if (!valid || rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  return rows;
}

async function photosForBottles(
  db: AppBatchDb,
  userId: string,
  bottleIds: readonly string[],
): Promise<Map<string, PhotoRow[]>> {
  const grouped = new Map<string, PhotoRow[]>();
  if (bottleIds.length === 0) {
    return grouped;
  }
  const rows = await db
    .select()
    .from(photos)
    .where(and(inArray(photos.bottleId, [...bottleIds]), eq(photos.userId, userId)))
    .orderBy(photos.sortOrder, photos.createdAt);
  for (const row of rows) {
    if (!row.bottleId) {
      continue;
    }
    const list = grouped.get(row.bottleId) ?? [];
    list.push(row);
    grouped.set(row.bottleId, list);
  }
  return grouped;
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
      .where(and(eq(photos.id, photo.id), eq(photos.userId, userId), isNull(photos.bottleId)));
  } catch {
    // 未紐付けのまま残し、24h 後の日次 GC に再試行させる。
  }
}

type CopiedPhoto = {
  id: string;
  r2Key: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  kind: PhotoKind;
  sortOrder: number;
};

async function copyPhotoObject(bucket: PhotoBucket, source: PhotoRow): Promise<CopiedPhoto> {
  const object = await bucket.get(source.r2Key);
  if (!object) {
    throw new ApiError("internal_error");
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  const id = crypto.randomUUID();
  const r2Key = `${id}.${extensionFromR2Key(source.r2Key)}`;
  await bucket.put(r2Key, bytes, {
    httpMetadata: { contentType: asContentType(source.contentType) },
  });
  return {
    id,
    r2Key,
    contentType: source.contentType,
    byteSize: source.byteSize,
    width: source.width,
    height: source.height,
    kind: source.kind,
    sortOrder: source.sortOrder,
  };
}

function attributesFromBody(body: CreateBottleInput | UpdateBottleInput) {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.drinkType === undefined ? {} : { drinkType: body.drinkType }),
    ...(body.producer === undefined ? {} : { producer: normalizeOptionalText(body.producer) }),
    ...(body.origin === undefined ? {} : { origin: writtenOrigin(body.origin) ?? null }),
    ...(body.variety === undefined ? {} : { variety: normalizeOptionalText(body.variety) }),
    ...(body.vintage === undefined ? {} : { vintage: body.vintage }),
    ...(body.purchasedOn === undefined ? {} : { purchasedOn: body.purchasedOn }),
    ...(body.priceJpy === undefined ? {} : { priceJpy: body.priceJpy }),
    ...(body.shop === undefined ? {} : { shop: normalizeOptionalText(body.shop) }),
    ...(body.storedOn === undefined ? {} : { storedOn: body.storedOn }),
    ...(body.storage === undefined ? {} : { storage: normalizeOptionalText(body.storage) }),
    ...(body.memo === undefined ? {} : { memo: normalizeOptionalText(body.memo) }),
  };
}

export async function createBottles(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  body: CreateBottleInput;
  now?: Date;
}): Promise<{ items: Bottle[] }> {
  const { db, bucket, userId, body } = input;
  const now = input.now ?? new Date();
  const count = body.count ?? 1;
  const sourcePhotos = await resolveUnattachedPhotos(db, userId, body.photoIds ?? []);
  const sourcePhoto = sourcePhotos[0];

  const copies: CopiedPhoto[] = [];
  if (sourcePhoto && count > 1) {
    try {
      for (let index = 1; index < count; index += 1) {
        copies.push(await copyPhotoObject(bucket, sourcePhoto));
      }
    } catch (error) {
      await Promise.all(copies.map((copy) => bucket.delete(copy.r2Key).catch(() => undefined)));
      throw error;
    }
  }

  const attrs = {
    userId,
    name: body.name,
    drinkType: body.drinkType,
    producer: normalizeOptionalText(body.producer),
    origin: writtenOrigin(body.origin) ?? null,
    variety: normalizeOptionalText(body.variety),
    vintage: body.vintage ?? null,
    purchasedOn: body.purchasedOn ?? null,
    priceJpy: body.priceJpy ?? null,
    shop: normalizeOptionalText(body.shop),
    storedOn: body.storedOn === undefined ? tokyoToday(now) : body.storedOn,
    storage:
      body.storage === undefined ? DEFAULT_BOTTLE_STORAGE : normalizeOptionalText(body.storage),
    memo: normalizeOptionalText(body.memo),
    status: DEFAULT_BOTTLE_STATUS,
    consumedAt: null,
    consumedOn: null,
    createdAt: now,
    updatedAt: now,
  };

  const rows: BottleRow[] = Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    ...attrs,
  }));

  try {
    const statements: BatchItem<"sqlite">[] = rows.map((row) => db.insert(bottles).values(row));
    if (sourcePhoto) {
      const first = rows[0];
      if (first) {
        statements.push(
          db
            .update(photos)
            .set({ bottleId: first.id, updatedAt: now })
            .where(
              and(
                eq(photos.id, sourcePhoto.id),
                eq(photos.userId, userId),
                isNull(photos.bottleId),
              ),
            ),
        );
      }
      for (const [index, copy] of copies.entries()) {
        const bottle = rows[index + 1];
        if (!bottle) {
          continue;
        }
        statements.push(
          db.insert(photos).values({
            id: copy.id,
            userId,
            r2Key: copy.r2Key,
            contentType: copy.contentType,
            byteSize: copy.byteSize,
            width: copy.width,
            height: copy.height,
            bottleId: bottle.id,
            tastingNoteId: null,
            drinkLogId: null,
            kind: copy.kind,
            sortOrder: copy.sortOrder,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
    }
    const [firstStatement, ...rest] = statements;
    if (!firstStatement) {
      throw new ApiError("internal_error");
    }
    await db.batch([firstStatement, ...rest]);
  } catch (error) {
    await Promise.all(copies.map((copy) => bucket.delete(copy.r2Key).catch(() => undefined)));
    throw error;
  }

  const photoByBottle = new Map<string, PhotoRow[]>();
  if (sourcePhoto && rows[0]) {
    photoByBottle.set(rows[0].id, [{ ...sourcePhoto, bottleId: rows[0].id, updatedAt: now }]);
  }
  for (const [index, copy] of copies.entries()) {
    const bottle = rows[index + 1];
    if (!bottle) {
      continue;
    }
    photoByBottle.set(bottle.id, [
      {
        id: copy.id,
        userId,
        r2Key: copy.r2Key,
        contentType: copy.contentType,
        byteSize: copy.byteSize,
        width: copy.width,
        height: copy.height,
        bottleId: bottle.id,
        tastingNoteId: null,
        drinkLogId: null,
        kind: copy.kind,
        sortOrder: copy.sortOrder,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  return {
    items: rows.map((row) => toBottle(row, photoByBottle.get(row.id) ?? [])),
  };
}

export type OwnBottleSnap = {
  id: string;
  name: string;
  drinkType: DrinkType;
  status: BottleStatus;
  producer: string | null;
  origin: string | null;
  variety: string | null;
  vintage: number | null;
};

/** 自分のボトルのみ。貯蔵庫も含む。他人・不在は同じ 404（存在を漏らさない）。 */
export async function requireOwnBottle(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
): Promise<OwnBottleSnap> {
  const [row] = await db
    .select({
      id: bottles.id,
      name: bottles.name,
      drinkType: bottles.drinkType,
      status: bottles.status,
      producer: bottles.producer,
      origin: bottles.origin,
      variety: bottles.variety,
      vintage: bottles.vintage,
    })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

export async function getOwnBottle(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
): Promise<Bottle> {
  const [row] = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const photoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.bottleId, bottleId), eq(photos.userId, userId)))
    .orderBy(photos.sortOrder, photos.createdAt);
  return toBottle(row, photoRows);
}

function searchCondition(q: string) {
  const pattern = `%${escapeLike(q)}%`;
  return or(
    sql`${bottles.name} LIKE ${pattern} ESCAPE '\\'`,
    sql`${bottles.producer} LIKE ${pattern} ESCAPE '\\'`,
    sql`${bottles.variety} LIKE ${pattern} ESCAPE '\\'`,
  );
}

export async function listBottles(input: {
  db: AppBatchDb;
  userId: string;
  query: BottlesQuery;
}): Promise<BottlesResponse> {
  const { db, userId, query } = input;
  const status = viewStatus(query.view);
  const viewConditions = [eq(bottles.userId, userId)];
  if (status) {
    viewConditions.push(eq(bottles.status, status));
  }

  const itemConditions = [...viewConditions];
  const q = query.q?.trim();
  if (q) {
    const search = searchCondition(q);
    if (search) {
      itemConditions.push(search);
    }
  }
  if (query.drinkType) {
    itemConditions.push(eq(bottles.drinkType, query.drinkType));
  }

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    const [anchor] = await db
      .select({
        id: bottles.id,
        createdAt: bottles.createdAt,
        consumedAt: bottles.consumedAt,
      })
      .from(bottles)
      .where(and(eq(bottles.id, cursor.id), ...viewConditions));
    if (!anchor || sortAt(anchor, query.view) !== cursor.at) {
      throw cursorError();
    }
    if (query.view === "archive") {
      itemConditions.push(
        sql`(coalesce(${bottles.consumedAt}, 0) < ${cursor.at} or (coalesce(${bottles.consumedAt}, 0) = ${cursor.at} and ${bottles.id} < ${cursor.id}))`,
      );
    } else {
      itemConditions.push(
        sql`(${bottles.createdAt} < ${cursor.at} or (${bottles.createdAt} = ${cursor.at} and ${bottles.id} < ${cursor.id}))`,
      );
    }
  }

  const [totalRow, typeRows, fetched] = await Promise.all([
    db
      .select({ n: count() })
      .from(bottles)
      .where(and(...viewConditions))
      .then((rows) => rows[0]),
    db
      .select({ drinkType: bottles.drinkType, n: count() })
      .from(bottles)
      .where(and(...viewConditions))
      .groupBy(bottles.drinkType),
    db
      .select()
      .from(bottles)
      .where(and(...itemConditions))
      .orderBy(
        query.view === "archive"
          ? desc(sql`coalesce(${bottles.consumedAt}, 0)`)
          : desc(bottles.createdAt),
        desc(bottles.id),
      )
      .limit(query.limit + 1),
  ]);

  const countsByType: CountsByType = emptyCountsByType();
  for (const row of typeRows) {
    countsByType[row.drinkType] += Number(row.n);
  }
  const { page, hasMore } = takeLimitPlusOne(fetched, query.limit);
  const photoMap = await photosForBottles(
    db,
    userId,
    page.map((row) => row.id),
  );
  const last = page.at(-1);
  return {
    items: page.map((row) => toBottleItem(row, photoMap.get(row.id) ?? [])),
    nextCursor: hasMore && last ? encodeCursor(last, query.view) : null,
    totalCount: Number(totalRow?.n ?? 0),
    countsByType,
  };
}

export async function updateBottle(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  bottleId: string;
  body: UpdateBottleInput;
  now?: Date;
}): Promise<Bottle> {
  const { db, bucket, userId, bottleId, body } = input;
  const [current] = await db
    .select()
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (!current) {
    throw new ApiError("not_found");
  }

  const desiredPhotoRows =
    body.photoIds === undefined
      ? undefined
      : await resolvePatchPhotos(db, userId, bottleId, body.photoIds);
  const currentPhotoRows =
    body.photoIds === undefined
      ? []
      : await db
          .select()
          .from(photos)
          .where(and(eq(photos.bottleId, bottleId), eq(photos.userId, userId)));
  const desiredIds = new Set(desiredPhotoRows?.map((photo) => photo.id) ?? []);
  const removedPhotoRows = currentPhotoRows.filter((photo) => !desiredIds.has(photo.id));
  const updatedAt = input.now ?? new Date();
  const patch = {
    ...attributesFromBody({ ...body, origin: undefined }),
    ...(body.origin === undefined ? {} : { origin: writtenOrigin(body.origin, current.origin) }),
    updatedAt,
  };

  const updateStatement = db
    .update(bottles)
    .set(patch)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  const detachStatement =
    removedPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ bottleId: null, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                removedPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              eq(photos.bottleId, bottleId),
            ),
          )
      : null;
  const attachStatement =
    desiredPhotoRows && desiredPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ bottleId, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                desiredPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.userId, userId),
              isNull(photos.tastingNoteId),
              isNull(photos.drinkLogId),
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

  return getOwnBottle(db, userId, bottleId);
}

export async function consumeBottle(input: {
  db: AppBatchDb;
  userId: string;
  bottleId: string;
  now?: Date;
}): Promise<Bottle> {
  const { db, userId, bottleId } = input;
  const now = input.now ?? new Date();
  const [current] = await db
    .select({ id: bottles.id, status: bottles.status })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (current?.status !== "sealed") {
    throw new ApiError("not_found");
  }
  await db
    .update(bottles)
    .set({
      status: "consumed",
      consumedAt: now,
      consumedOn: tokyoToday(now),
      updatedAt: now,
    })
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId), eq(bottles.status, "sealed")));
  return getOwnBottle(db, userId, bottleId);
}

export async function restoreBottle(input: {
  db: AppBatchDb;
  userId: string;
  bottleId: string;
  now?: Date;
}): Promise<Bottle> {
  const { db, userId, bottleId } = input;
  const now = input.now ?? new Date();
  const [current] = await db
    .select({ id: bottles.id, status: bottles.status })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (current?.status !== "consumed") {
    throw new ApiError("not_found");
  }
  await db
    .update(bottles)
    .set({
      status: "sealed",
      consumedAt: null,
      consumedOn: null,
      updatedAt: now,
    })
    .where(
      and(eq(bottles.id, bottleId), eq(bottles.userId, userId), eq(bottles.status, "consumed")),
    );
  return getOwnBottle(db, userId, bottleId);
}

export async function deleteBottle(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  bottleId: string;
}): Promise<void> {
  const { db, bucket, userId, bottleId } = input;
  const [row] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  const photoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.bottleId, bottleId), eq(photos.userId, userId)));
  for (const photo of photoRows) {
    const scope = and(eq(photos.id, photo.id), eq(photos.userId, userId));
    try {
      await bucket.delete(photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db.update(photos).set({ bottleId: null, updatedAt: new Date() }).where(scope);
    }
  }
  await db.delete(bottles).where(and(eq(bottles.id, bottleId), eq(bottles.userId, userId)));
}

export type { DrinkType };
