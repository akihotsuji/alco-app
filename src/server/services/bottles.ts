import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import { bottles, photos, userCellarSlots } from "@/db/schema.ts";
import {
  BOTTLE_MESSAGES,
  BOTTLE_PHOTO_MAX,
  type Bottle,
  type BottleItem,
  type BottleMutationBody,
  type BottlesQuery,
  type BottlesResponse,
  type BottleView,
  type CountsByType,
  type CreateBottleInput,
  DEFAULT_BOTTLE_STORAGE,
  emptyCountsByType,
  escapeLike,
  normalizeOptionalText,
  type ReorderBottlesInput,
  type UpdateBottleInput,
} from "@/shared/bottles.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";
import type { BottleStatus, DrinkType, PhotoContentType, PhotoKind } from "@/shared/constants.ts";
import { DEFAULT_BOTTLE_STATUS, DRINK_TYPES, PHOTO_CONTENT_TYPES } from "@/shared/constants.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
import { takeLimitPlusOne } from "../lib/keyset-page.ts";
import {
  actorDisplayName,
  assertSharedVersion,
  bumpCellarRevision,
  displayNamesById,
  memberCondition,
  membershipSql,
  personalCellarSql,
  recordActivity,
  requireAccessibleBottle,
  requireCellarMember,
  resolveBottleCellarId,
} from "./cellar-access.ts";
import { hashRequestBody } from "./cellar-crypto.ts";
import { idempotencyInsert, readIdempotentResult, recoverIdempotentResult } from "./idempotency.ts";
import { writtenOrigin } from "./origin-write.ts";
import { type PhotoBucket, toPhotoMeta } from "./photos.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";

type BottleRow = typeof bottles.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;

type ActorNames = {
  createdByName: string | null;
  updatedByName: string | null;
};

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

function namesFromMap(
  row: Pick<BottleRow, "createdBy" | "updatedBy">,
  map: Map<string, string>,
): ActorNames {
  return {
    createdByName: row.createdBy ? actorDisplayName(row.createdBy, map) : null,
    updatedByName: row.updatedBy ? actorDisplayName(row.updatedBy, map) : null,
  };
}

export function toBottle(
  row: BottleRow,
  photoRows: readonly PhotoRow[],
  names: ActorNames = { createdByName: null, updatedByName: null },
): Bottle {
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
    cellarId: row.cellarId,
    version: row.version,
    createdByName: names.createdByName,
    updatedByName: names.updatedByName,
    photos: photoRows.map(toPhotoMeta),
    createdAt: requireIso(row.createdAt),
    updatedAt: requireIso(row.updatedAt),
  };
}

export function toBottleItem(
  row: BottleRow,
  photoRows: readonly PhotoRow[],
  names: ActorNames = { createdByName: null, updatedByName: null },
): BottleItem {
  const { photos: _photos, ...item } = toBottle(row, photoRows, names);
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

function usesTypeSort(query: Pick<BottlesQuery, "view" | "drinkType">): boolean {
  return query.view === "cellar" && Boolean(query.drinkType);
}

function listOrderBy(query: Pick<BottlesQuery, "view" | "drinkType">) {
  if (query.view === "archive") {
    return [desc(sql`coalesce(${bottles.consumedAt}, 0)`), desc(bottles.id)] as const;
  }
  if (usesTypeSort(query)) {
    return [asc(bottles.sortOrder), asc(bottles.id)] as const;
  }
  return [desc(bottles.createdAt), desc(bottles.id)] as const;
}

function listCursorAt(
  row: { createdAt: Date; consumedAt: Date | null; sortOrder: number },
  query: Pick<BottlesQuery, "view" | "drinkType">,
): number {
  if (query.view === "archive") {
    return row.consumedAt?.getTime() ?? 0;
  }
  if (usesTypeSort(query)) {
    return row.sortOrder;
  }
  return row.createdAt.getTime();
}

function encodeCursor(row: BottleRow, query: Pick<BottlesQuery, "view" | "drinkType">): string {
  return btoa(JSON.stringify({ id: row.id, at: listCursorAt(row, query) }))
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
  if (unique.length !== photoIds.length || unique.length > BOTTLE_PHOTO_MAX) {
    throw new ApiError("not_found");
  }
  if (unique.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(photos)
    .where(
      and(
        inArray(photos.id, unique),
        eq(photos.userId, userId),
        isNull(photos.cellarId),
        isNull(photos.bottleId),
        isNull(photos.tastingNoteId),
        isNull(photos.drinkLogId),
      ),
    );
  if (rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  return orderPhotosByIds(rows, photoIds);
}

/** `photoIds` の順（[0] = 表面、[1] = 裏面）を保つ。添字がそのまま `sort_order` になる。 */
function orderPhotosByIds(rows: readonly PhotoRow[], photoIds: readonly string[]): PhotoRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: PhotoRow[] = [];
  for (const id of photoIds) {
    const row = byId.get(id);
    if (row) {
      ordered.push(row);
    }
  }
  return ordered;
}

async function resolvePatchPhotos(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
  cellarId: string,
  photoIds: readonly string[],
): Promise<PhotoRow[]> {
  const unique = [...new Set(photoIds)];
  if (unique.length !== photoIds.length || unique.length > BOTTLE_PHOTO_MAX) {
    throw new ApiError("not_found");
  }
  if (unique.length === 0) {
    return [];
  }
  const rows = await db.select().from(photos).where(inArray(photos.id, unique));
  const valid = rows.every(
    (photo) =>
      photo.tastingNoteId === null &&
      photo.drinkLogId === null &&
      ((photo.userId === userId && photo.cellarId === null && photo.bottleId === null) ||
        (photo.bottleId === bottleId && photo.cellarId === cellarId)),
  );
  if (!valid || rows.length !== unique.length) {
    throw new ApiError("not_found");
  }
  return orderPhotosByIds(rows, photoIds);
}

async function photosForBottles(
  db: AppBatchDb,
  bottleIds: readonly string[],
): Promise<Map<string, PhotoRow[]>> {
  const grouped = new Map<string, PhotoRow[]>();
  if (bottleIds.length === 0) {
    return grouped;
  }
  const rows = await db
    .select()
    .from(photos)
    .where(inArray(photos.bottleId, [...bottleIds]))
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
    await deletePhotoR2Objects(bucket, photo.r2Key);
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

async function listScopeCondition(db: AppBatchDb, userId: string, query: BottlesQuery) {
  if (query.cellarId) {
    await requireCellarMember(db, userId, query.cellarId);
    return eq(bottles.cellarId, query.cellarId);
  }
  if (query.scope === "accessible") {
    return memberCondition(userId);
  }
  return personalCellarSql(userId);
}

function versionConflict(current: Bottle): ApiError {
  return new ApiError("conflict", {
    fields: { expectedVersion: [CELLAR_COPY.conflictEdit] },
    conflict: { reason: "version", current },
  });
}

async function frontSortOrders(
  db: AppBatchDb,
  cellarId: string,
  drinkType: DrinkType,
  count: number,
): Promise<number[]> {
  const [row] = await db
    .select({ min: sql<number | null>`min(${bottles.sortOrder})` })
    .from(bottles)
    .where(
      and(
        eq(bottles.cellarId, cellarId),
        eq(bottles.drinkType, drinkType),
        eq(bottles.status, "sealed"),
      ),
    );
  const start = (row?.min ?? 0) - count;
  return Array.from({ length: count }, (_, index) => start + index);
}

async function resolveReorderCellarId(
  db: AppBatchDb,
  userId: string,
  cellarId: string | undefined,
): Promise<string> {
  if (cellarId) {
    await requireCellarMember(db, userId, cellarId);
    return cellarId;
  }
  const [slot] = await db
    .select({ personalCellarId: userCellarSlots.personalCellarId })
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, userId));
  if (!slot) {
    throw new ApiError("not_found");
  }
  return slot.personalCellarId;
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
  const cellarId = await resolveBottleCellarId(db, userId, body.cellarId);
  const requestHash = await hashRequestBody({ action: "create", ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<{ items: Bottle[] }>(db, {
      actorUserId: userId,
      cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return cached;
    }
  }

  const count = body.count ?? 1;
  const sortOrders = await frontSortOrders(db, cellarId, body.drinkType, count);
  const sourcePhotos = await resolveUnattachedPhotos(db, userId, body.photoIds ?? []);

  // copies[i] = i+2 本目に付ける写真の組（表 + 裏）。1 本目は元の未紐付け写真をそのまま紐付ける。
  const copies: CopiedPhoto[][] = [];
  const flatCopies = (): CopiedPhoto[] => copies.flat();
  if (sourcePhotos.length > 0 && count > 1) {
    try {
      for (let index = 1; index < count; index += 1) {
        const set: CopiedPhoto[] = [];
        for (const [sortOrder, source] of sourcePhotos.entries()) {
          set.push({ ...(await copyPhotoObject(bucket, source)), sortOrder });
        }
        copies.push(set);
      }
    } catch (error) {
      await Promise.all(
        flatCopies().map((copy) => deletePhotoR2Objects(bucket, copy.r2Key).catch(() => undefined)),
      );
      throw error;
    }
  }

  const attrs = {
    cellarId,
    createdBy: userId,
    updatedBy: userId,
    version: 1,
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

  const rows: BottleRow[] = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    ...attrs,
    sortOrder: sortOrders[index] ?? 0,
  }));
  const nameMap = await displayNamesById(db, [userId]);
  const names = namesFromMap({ createdBy: userId, updatedBy: userId }, nameMap);

  try {
    const statements: BatchItem<"sqlite">[] = rows.map((row) => db.insert(bottles).values(row));
    const first = rows[0];
    if (first) {
      for (const [sortOrder, sourcePhoto] of sourcePhotos.entries()) {
        statements.push(
          db
            .update(photos)
            .set({
              bottleId: first.id,
              cellarId,
              userId: null,
              sortOrder,
              updatedAt: now,
            })
            .where(
              and(
                eq(photos.id, sourcePhoto.id),
                eq(photos.userId, userId),
                isNull(photos.bottleId),
              ),
            ),
        );
      }
    }
    for (const [index, set] of copies.entries()) {
      const bottle = rows[index + 1];
      if (!bottle) {
        continue;
      }
      for (const copy of set) {
        statements.push(
          db.insert(photos).values({
            id: copy.id,
            userId: null,
            cellarId,
            uploadedBy: userId,
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
    statements.push(bumpCellarRevision(db, cellarId, now));
    for (const row of rows) {
      statements.push(
        recordActivity(db, {
          cellarId,
          actorUserId: userId,
          action: "bottle_created",
          bottleId: row.id,
          bottleName: row.name,
          now,
        }),
      );
    }
    if (body.operationKey) {
      const preview = {
        items: rows.map((row) => toBottle(row, [], names)),
      };
      statements.push(
        idempotencyInsert(db, {
          actorUserId: userId,
          cellarId,
          operationKey: body.operationKey,
          requestHash,
          result: preview,
          now,
        }),
      );
    }
    const [firstStatement, ...rest] = statements;
    if (!firstStatement) {
      throw new ApiError("internal_error");
    }
    await db.batch([firstStatement, ...rest]);
  } catch (error) {
    await Promise.all(
      flatCopies().map((copy) => deletePhotoR2Objects(bucket, copy.r2Key).catch(() => undefined)),
    );
    if (body.operationKey) {
      const recovered = await recoverIdempotentResult<{ items: Bottle[] }>(db, {
        actorUserId: userId,
        cellarId,
        operationKey: body.operationKey,
        requestHash,
      });
      if (recovered) {
        return recovered;
      }
    }
    throw error;
  }

  const photoByBottle = new Map<string, PhotoRow[]>();
  if (sourcePhotos.length > 0 && rows[0]) {
    const firstId = rows[0].id;
    photoByBottle.set(
      firstId,
      sourcePhotos.map((sourcePhoto, sortOrder) => ({
        ...sourcePhoto,
        bottleId: firstId,
        cellarId,
        userId: null,
        sortOrder,
        updatedAt: now,
      })),
    );
  }
  for (const [index, set] of copies.entries()) {
    const bottle = rows[index + 1];
    if (!bottle) {
      continue;
    }
    photoByBottle.set(
      bottle.id,
      set.map((copy) => ({
        id: copy.id,
        userId: null,
        cellarId,
        uploadedBy: userId,
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
      })),
    );
  }

  return {
    items: rows.map((row) => toBottle(row, photoByBottle.get(row.id) ?? [], names)),
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

/** 所属セラーのボトルのみ。貯蔵庫も含む。他人・不在は同じ 404（存在を漏らさない）。 */
export async function requireOwnBottle(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
): Promise<OwnBottleSnap> {
  const row = await requireAccessibleBottle(db, userId, bottleId);
  return {
    id: row.id,
    name: row.name,
    drinkType: row.drinkType,
    status: row.status,
    producer: row.producer,
    origin: row.origin,
    variety: row.variety,
    vintage: row.vintage,
  };
}

export async function getOwnBottle(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
): Promise<Bottle> {
  const row = await requireAccessibleBottle(db, userId, bottleId);
  const photoRows = await db
    .select()
    .from(photos)
    .where(eq(photos.bottleId, bottleId))
    .orderBy(photos.sortOrder, photos.createdAt);
  const nameMap = await displayNamesById(db, [row.createdBy, row.updatedBy]);
  return toBottle(row, photoRows, namesFromMap(row, nameMap));
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
  const scopeCondition = await listScopeCondition(db, userId, query);
  const status = viewStatus(query.view);
  const viewConditions = [scopeCondition];
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
        sortOrder: bottles.sortOrder,
      })
      .from(bottles)
      .where(and(eq(bottles.id, cursor.id), ...viewConditions));
    if (!anchor || listCursorAt(anchor, query) !== cursor.at) {
      throw cursorError();
    }
    if (query.view === "archive") {
      itemConditions.push(
        sql`(coalesce(${bottles.consumedAt}, 0) < ${cursor.at} or (coalesce(${bottles.consumedAt}, 0) = ${cursor.at} and ${bottles.id} < ${cursor.id}))`,
      );
    } else if (usesTypeSort(query)) {
      itemConditions.push(
        sql`(${bottles.sortOrder} > ${cursor.at} or (${bottles.sortOrder} = ${cursor.at} and ${bottles.id} > ${cursor.id}))`,
      );
    } else {
      itemConditions.push(
        sql`(${bottles.createdAt} < ${cursor.at} or (${bottles.createdAt} = ${cursor.at} and ${bottles.id} < ${cursor.id}))`,
      );
    }
  }

  const countQuery = db
    .select({ n: count() })
    .from(bottles)
    .where(and(...viewConditions))
    .then((rows) => rows[0]);
  const typeCountQuery = db
    .select({ drinkType: bottles.drinkType, n: count() })
    .from(bottles)
    .where(and(...viewConditions))
    .groupBy(bottles.drinkType);

  if (query.group === "type") {
    const [totalRow, typeRows] = await Promise.all([countQuery, typeCountQuery]);
    const countsByType: CountsByType = emptyCountsByType();
    for (const row of typeRows) {
      countsByType[row.drinkType] += Number(row.n);
    }
    const typesToFetch = DRINK_TYPES.filter((drinkType) => countsByType[drinkType] > 0);
    const fetchedByType = await Promise.all(
      typesToFetch.map(async (drinkType) => {
        const typeQuery = { view: query.view, drinkType };
        const rows = await db
          .select()
          .from(bottles)
          .where(and(...itemConditions, eq(bottles.drinkType, drinkType)))
          .orderBy(...listOrderBy(typeQuery))
          .limit(query.limit + 1);
        return { drinkType, rows, typeQuery };
      }),
    );
    const pages = fetchedByType.map(({ drinkType, rows, typeQuery }) => {
      const { page, hasMore } = takeLimitPlusOne(rows, query.limit);
      const last = page.at(-1);
      return {
        drinkType,
        page,
        nextCursor: hasMore && last ? encodeCursor(last, typeQuery) : null,
      };
    });
    const previewRows = pages.flatMap((shelf) => shelf.page);
    const [photoMap, nameMap] = await Promise.all([
      photosForBottles(
        db,
        previewRows.map((row) => row.id),
      ),
      displayNamesById(
        db,
        previewRows.flatMap((row) => [row.createdBy, row.updatedBy]),
      ),
    ]);
    const typeShelves = pages
      .map((shelf) => ({
        drinkType: shelf.drinkType,
        items: shelf.page.map((row) =>
          toBottleItem(row, photoMap.get(row.id) ?? [], namesFromMap(row, nameMap)),
        ),
        nextCursor: shelf.nextCursor,
      }))
      .filter((shelf) => shelf.items.length > 0);
    return {
      items: typeShelves.flatMap((shelf) => shelf.items),
      nextCursor: null,
      totalCount: Number(totalRow?.n ?? 0),
      countsByType,
      typeShelves,
    };
  }

  const [totalRow, typeRows, fetched] = await Promise.all([
    countQuery,
    typeCountQuery,
    db
      .select()
      .from(bottles)
      .where(and(...itemConditions))
      .orderBy(...listOrderBy(query))
      .limit(query.limit + 1),
  ]);

  const countsByType: CountsByType = emptyCountsByType();
  for (const row of typeRows) {
    countsByType[row.drinkType] += Number(row.n);
  }
  const { page, hasMore } = takeLimitPlusOne(fetched, query.limit);
  const [photoMap, nameMap] = await Promise.all([
    photosForBottles(
      db,
      page.map((row) => row.id),
    ),
    displayNamesById(
      db,
      page.flatMap((row) => [row.createdBy, row.updatedBy]),
    ),
  ]);
  const last = page.at(-1);
  return {
    items: page.map((row) =>
      toBottleItem(row, photoMap.get(row.id) ?? [], namesFromMap(row, nameMap)),
    ),
    nextCursor: hasMore && last ? encodeCursor(last, query) : null,
    totalCount: Number(totalRow?.n ?? 0),
    countsByType,
  };
}

async function loadCurrentForWrite(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
): Promise<BottleRow & { cellarKind: "personal" | "shared" }> {
  return requireAccessibleBottle(db, userId, bottleId);
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
  const current = await loadCurrentForWrite(db, userId, bottleId);
  assertSharedVersion(current.cellarKind, body.expectedVersion);
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }

  const requestHash = await hashRequestBody({ action: "update", bottleId, ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<Bottle>(db, {
      actorUserId: userId,
      cellarId: current.cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return cached;
    }
  }

  const [photoBundle, nameMap] = await Promise.all([
    body.photoIds === undefined
      ? photosForBottles(db, [bottleId]).then((map) => ({
          desired: undefined as PhotoRow[] | undefined,
          currentRows: map.get(bottleId) ?? [],
        }))
      : Promise.all([
          resolvePatchPhotos(db, userId, bottleId, current.cellarId, body.photoIds),
          photosForBottles(db, [bottleId]),
        ]).then(([desired, map]) => ({ desired, currentRows: map.get(bottleId) ?? [] })),
    displayNamesById(db, [current.createdBy, userId]),
  ]);
  const desiredPhotoRows = photoBundle.desired;
  const currentPhotoRows = photoBundle.currentRows;
  const desiredIds = new Set(desiredPhotoRows?.map((photo) => photo.id) ?? []);
  const removedPhotoRows = currentPhotoRows.filter((photo) => !desiredIds.has(photo.id));
  const updatedAt = input.now ?? new Date();
  let nextSortOrder: number | undefined;
  if (
    body.drinkType !== undefined &&
    body.drinkType !== current.drinkType &&
    current.status === "sealed"
  ) {
    nextSortOrder = (await frontSortOrders(db, current.cellarId, body.drinkType, 1))[0] ?? 0;
  }
  const patch = {
    ...attributesFromBody({ ...body, origin: undefined }),
    ...(body.origin === undefined ? {} : { origin: writtenOrigin(body.origin, current.origin) }),
    ...(nextSortOrder === undefined ? {} : { sortOrder: nextSortOrder }),
    updatedBy: userId,
    version: current.version + 1,
    updatedAt,
  };

  const conditions = [
    eq(bottles.id, bottleId),
    eq(bottles.cellarId, current.cellarId),
    membershipSql(userId),
  ];
  if (body.expectedVersion !== undefined) {
    conditions.push(eq(bottles.version, body.expectedVersion));
  }

  const updateStatement = db
    .update(bottles)
    .set(patch)
    .where(and(...conditions))
    .returning();
  const detachStatement =
    removedPhotoRows.length > 0
      ? db
          .update(photos)
          .set({ bottleId: null, cellarId: null, userId, updatedAt })
          .where(
            and(
              inArray(
                photos.id,
                removedPhotoRows.map((photo) => photo.id),
              ),
              eq(photos.bottleId, bottleId),
            ),
          )
      : null;
  // 残す写真も含めて添字を sort_order に書き直す（[0] = 表面、[1] = 裏面）。
  const attachStatements = (desiredPhotoRows ?? []).map((photo, sortOrder) =>
    db
      .update(photos)
      .set({ bottleId, cellarId: current.cellarId, userId: null, sortOrder, updatedAt })
      .where(and(eq(photos.id, photo.id), isNull(photos.tastingNoteId), isNull(photos.drinkLogId))),
  );

  const extra: BatchItem<"sqlite">[] = [
    bumpCellarRevision(db, current.cellarId, updatedAt),
    recordActivity(db, {
      cellarId: current.cellarId,
      actorUserId: userId,
      action: body.photoIds === undefined ? "bottle_updated" : "bottle_photo_changed",
      bottleId,
      bottleName: current.name,
      now: updatedAt,
    }),
  ];

  let after: BottleRow | undefined;
  try {
    const [updatedRows] = await db.batch([
      updateStatement,
      ...(detachStatement ? [detachStatement] : []),
      ...attachStatements,
      ...extra,
    ]);
    after = updatedRows[0];
  } catch (error) {
    if (body.operationKey) {
      const recovered = await recoverIdempotentResult<Bottle>(db, {
        actorUserId: userId,
        cellarId: current.cellarId,
        operationKey: body.operationKey,
        requestHash,
      });
      if (recovered) {
        return recovered;
      }
    }
    throw error;
  }

  if (!after) {
    throw body.expectedVersion !== undefined
      ? versionConflict(await getOwnBottle(db, userId, bottleId))
      : new ApiError("not_found");
  }
  if (body.expectedVersion !== undefined && after.version !== body.expectedVersion + 1) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }

  if (desiredPhotoRows !== undefined) {
    await Promise.all(
      removedPhotoRows.map((photo) => removeDetachedPhoto(db, bucket, userId, photo)),
    );
  }

  const resultPhotos =
    desiredPhotoRows === undefined
      ? currentPhotoRows
      : desiredPhotoRows.map((photo, sortOrder) => ({
          ...photo,
          bottleId,
          cellarId: current.cellarId,
          userId: null,
          sortOrder,
          updatedAt,
        }));
  const result = toBottle(after, resultPhotos, namesFromMap(after, nameMap));
  if (body.operationKey) {
    await db.batch([
      idempotencyInsert(db, {
        actorUserId: userId,
        cellarId: current.cellarId,
        operationKey: body.operationKey,
        requestHash,
        result,
        now: updatedAt,
      }),
    ]);
  }
  return result;
}

export async function consumeBottle(input: {
  db: AppBatchDb;
  userId: string;
  bottleId: string;
  body?: BottleMutationBody;
  now?: Date;
}): Promise<Bottle> {
  const { db, userId, bottleId } = input;
  const body = input.body ?? {};
  const now = input.now ?? new Date();
  const current = await loadCurrentForWrite(db, userId, bottleId);
  assertSharedVersion(current.cellarKind, body.expectedVersion);
  if (current.status !== "sealed") {
    if (current.cellarKind === "shared") {
      throw new ApiError("conflict", {
        fields: { "": [CELLAR_COPY.alreadyConsumed] },
        conflict: { reason: "version", current: await getOwnBottle(db, userId, bottleId) },
      });
    }
    throw new ApiError("not_found");
  }
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }

  const requestHash = await hashRequestBody({ action: "consume", bottleId, ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<Bottle>(db, {
      actorUserId: userId,
      cellarId: current.cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return cached;
    }
  }

  const conditions = [
    eq(bottles.id, bottleId),
    eq(bottles.cellarId, current.cellarId),
    eq(bottles.status, "sealed"),
    membershipSql(userId),
  ];
  if (body.expectedVersion !== undefined) {
    conditions.push(eq(bottles.version, body.expectedVersion));
  }

  const [photoMap, nameMap, [updatedRows]] = await Promise.all([
    photosForBottles(db, [bottleId]),
    displayNamesById(db, [current.createdBy, userId]),
    db.batch([
      db
        .update(bottles)
        .set({
          status: "consumed",
          consumedAt: now,
          consumedOn: tokyoToday(now),
          updatedBy: userId,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(and(...conditions))
        .returning(),
      bumpCellarRevision(db, current.cellarId, now),
      recordActivity(db, {
        cellarId: current.cellarId,
        actorUserId: userId,
        action: "bottle_consumed",
        bottleId,
        bottleName: current.name,
        now,
      }),
    ]),
  ]);

  const after = updatedRows[0];
  if (after?.status !== "consumed") {
    throw new ApiError("conflict", {
      fields: { "": [CELLAR_COPY.alreadyConsumed] },
      conflict: {
        reason: "version",
        current: after ? await getOwnBottle(db, userId, bottleId) : undefined,
      },
    });
  }
  const result = toBottle(after, photoMap.get(bottleId) ?? [], namesFromMap(after, nameMap));
  if (body.operationKey) {
    await db.batch([
      idempotencyInsert(db, {
        actorUserId: userId,
        cellarId: current.cellarId,
        operationKey: body.operationKey,
        requestHash,
        result,
        now,
      }),
    ]);
  }
  return result;
}

export async function restoreBottle(input: {
  db: AppBatchDb;
  userId: string;
  bottleId: string;
  body?: BottleMutationBody;
  now?: Date;
}): Promise<Bottle> {
  const { db, userId, bottleId } = input;
  const body = input.body ?? {};
  const now = input.now ?? new Date();
  const current = await loadCurrentForWrite(db, userId, bottleId);
  assertSharedVersion(current.cellarKind, body.expectedVersion);
  if (current.status !== "consumed") {
    throw new ApiError("not_found");
  }
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }

  const requestHash = await hashRequestBody({ action: "restore", bottleId, ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<Bottle>(db, {
      actorUserId: userId,
      cellarId: current.cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return cached;
    }
  }

  const conditions = [
    eq(bottles.id, bottleId),
    eq(bottles.cellarId, current.cellarId),
    eq(bottles.status, "consumed"),
    membershipSql(userId),
  ];
  if (body.expectedVersion !== undefined) {
    conditions.push(eq(bottles.version, body.expectedVersion));
  }

  const sortOrder = (await frontSortOrders(db, current.cellarId, current.drinkType, 1))[0] ?? 0;
  const [photoMap, nameMap, [updatedRows]] = await Promise.all([
    photosForBottles(db, [bottleId]),
    displayNamesById(db, [current.createdBy, userId]),
    db.batch([
      db
        .update(bottles)
        .set({
          status: "sealed",
          consumedAt: null,
          consumedOn: null,
          sortOrder,
          updatedBy: userId,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(and(...conditions))
        .returning(),
      bumpCellarRevision(db, current.cellarId, now),
      recordActivity(db, {
        cellarId: current.cellarId,
        actorUserId: userId,
        action: "bottle_restored",
        bottleId,
        bottleName: current.name,
        now,
      }),
    ]),
  ]);

  const after = updatedRows[0];
  if (after?.status !== "sealed") {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }
  const result = toBottle(after, photoMap.get(bottleId) ?? [], namesFromMap(after, nameMap));
  if (body.operationKey) {
    await db.batch([
      idempotencyInsert(db, {
        actorUserId: userId,
        cellarId: current.cellarId,
        operationKey: body.operationKey,
        requestHash,
        result,
        now,
      }),
    ]);
  }
  return result;
}

export async function reorderBottles(input: {
  db: AppBatchDb;
  userId: string;
  body: ReorderBottlesInput;
  now?: Date;
}): Promise<{ ok: true }> {
  const { db, userId, body } = input;
  const now = input.now ?? new Date();
  const cellarId = await resolveReorderCellarId(db, userId, body.cellarId);
  const requestHash = await hashRequestBody({ action: "reorder", ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<{ ok: true }>(db, {
      actorUserId: userId,
      cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return cached;
    }
  }

  const currentRows = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(
      and(
        eq(bottles.cellarId, cellarId),
        eq(bottles.drinkType, body.drinkType),
        eq(bottles.status, "sealed"),
        membershipSql(userId),
      ),
    );
  const currentIds = new Set(currentRows.map((row) => row.id));
  if (body.bottleIds.some((id) => !currentIds.has(id))) {
    throw new ApiError("not_found");
  }
  if (currentIds.size !== body.bottleIds.length) {
    throw new ApiError("conflict", {
      fields: { bottleIds: [BOTTLE_MESSAGES.orderConflict] },
      conflict: { reason: "set" },
    });
  }

  const orderCases = body.bottleIds.map((id, index) => sql`when ${id} then ${index}`);
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(bottles)
      .set({
        sortOrder: sql`case ${bottles.id} ${sql.join(orderCases, sql` `)} end`,
        version: sql`${bottles.version} + 1`,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(bottles.cellarId, cellarId),
          eq(bottles.drinkType, body.drinkType),
          eq(bottles.status, "sealed"),
          inArray(bottles.id, body.bottleIds),
          membershipSql(userId),
        ),
      ),
    bumpCellarRevision(db, cellarId, now),
  ];
  if (body.operationKey) {
    statements.push(
      idempotencyInsert(db, {
        actorUserId: userId,
        cellarId,
        operationKey: body.operationKey,
        requestHash,
        result: { ok: true },
        now,
      }),
    );
  }

  const [first, ...rest] = statements;
  if (!first) {
    throw new ApiError("internal_error");
  }
  try {
    await db.batch([first, ...rest]);
  } catch (error) {
    if (body.operationKey) {
      const recovered = await recoverIdempotentResult<{ ok: true }>(db, {
        actorUserId: userId,
        cellarId,
        operationKey: body.operationKey,
        requestHash,
      });
      if (recovered) {
        return recovered;
      }
    }
    throw error;
  }
  return { ok: true };
}

export async function deleteBottle(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  bottleId: string;
  body?: BottleMutationBody;
}): Promise<void> {
  const { db, bucket, userId, bottleId } = input;
  const body = input.body ?? {};
  const current = await loadCurrentForWrite(db, userId, bottleId);
  assertSharedVersion(current.cellarKind, body.expectedVersion);
  if (body.expectedVersion !== undefined && body.expectedVersion !== current.version) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }

  const requestHash = await hashRequestBody({ action: "delete", bottleId, ...body });
  if (body.operationKey) {
    const cached = await readIdempotentResult<{ ok: true }>(db, {
      actorUserId: userId,
      cellarId: current.cellarId,
      operationKey: body.operationKey,
      requestHash,
    });
    if (cached) {
      return;
    }
  }

  const photoRows = await db.select().from(photos).where(eq(photos.bottleId, bottleId));
  for (const photo of photoRows) {
    const scope = eq(photos.id, photo.id);
    try {
      await deletePhotoR2Objects(bucket, photo.r2Key);
      await db.delete(photos).where(scope);
    } catch {
      await db
        .update(photos)
        .set({ bottleId: null, cellarId: null, userId, updatedAt: new Date() })
        .where(scope);
    }
  }

  const now = new Date();
  const conditions = [
    eq(bottles.id, bottleId),
    eq(bottles.cellarId, current.cellarId),
    membershipSql(userId),
  ];
  if (body.expectedVersion !== undefined) {
    conditions.push(eq(bottles.version, body.expectedVersion));
  }
  await db.batch([
    db.delete(bottles).where(and(...conditions)),
    bumpCellarRevision(db, current.cellarId, now),
    recordActivity(db, {
      cellarId: current.cellarId,
      actorUserId: userId,
      action: "bottle_deleted",
      bottleId,
      bottleName: current.name,
      now,
    }),
  ]);
  const [still] = await db.select({ id: bottles.id }).from(bottles).where(eq(bottles.id, bottleId));
  if (still) {
    throw versionConflict(await getOwnBottle(db, userId, bottleId));
  }
  if (body.operationKey) {
    await db.batch([
      idempotencyInsert(db, {
        actorUserId: userId,
        cellarId: current.cellarId,
        operationKey: body.operationKey,
        requestHash,
        result: { ok: true },
        now,
      }),
    ]);
  }
}

export async function touchBottleForPhotoChange(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
  now: Date = new Date(),
): Promise<void> {
  const current = await requireAccessibleBottle(db, userId, bottleId);
  await db.batch([
    db
      .update(bottles)
      .set({
        version: current.version + 1,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(and(eq(bottles.id, bottleId), membershipSql(userId))),
    bumpCellarRevision(db, current.cellarId, now),
    recordActivity(db, {
      cellarId: current.cellarId,
      actorUserId: userId,
      action: "bottle_photo_changed",
      bottleId,
      bottleName: current.name,
      now,
    }),
  ]);
}

export type { DrinkType };
