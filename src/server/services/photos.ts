import { and, count, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { AppBatchDb, AppSqliteDb } from "@/db/index.ts";
import {
  bottles,
  cellarMembers,
  drinkLogs,
  photoObjectReservations,
  photos,
  tastingNotes,
  user,
} from "@/db/schema.ts";
import { PHOTO_RESERVATION_LEASE_MS } from "@/shared/account-deletion.ts";
import {
  PHOTO_CONTENT_TYPES,
  PHOTO_OWNER_LIMITS,
  PHOTO_UPLOAD_DAILY_LIMIT,
  type PhotoContentType,
  type PhotoKind,
} from "@/shared/constants.ts";
import {
  PHOTO_SINGLE_OWNER_MESSAGE,
  type PhotoMeta,
  type PhotoPatchInput,
  type PhotoUploadFields,
  photoOwnerIds,
} from "@/shared/photos.ts";
import { tokyoDayStartMs, tokyoToday } from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";
import {
  type GeneratedPhotoThumb,
  generatePhotoThumb,
  photoThumbContentType,
  photoThumbR2Key,
} from "../lib/photo-thumb.ts";
import {
  type AccessibleBottle,
  bumpCellarRevision,
  recordActivity,
  requireAccessibleBottle,
} from "./cellar-access.ts";
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";

export type PhotoObject = {
  arrayBuffer(): Promise<ArrayBuffer>;
  contentType?: string;
};

export type PhotoBucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<PhotoObject | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<{ objects: { key: string }[] }>;
};

export function wrapR2Bucket(bucket: R2Bucket): PhotoBucket {
  return {
    put(key, value, options) {
      return bucket.put(key, value, options);
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) {
        return null;
      }
      return {
        arrayBuffer: () => object.arrayBuffer(),
        contentType: object.httpMetadata?.contentType,
      };
    },
    async delete(key) {
      await bucket.delete(key);
    },
    async list(prefix) {
      const objects: { key: string }[] = [];
      let cursor: string | undefined;
      do {
        const listed = await bucket.list({ prefix, cursor });
        for (const item of listed.objects) {
          objects.push({ key: item.key });
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
      return { objects };
    },
  };
}

export type PhotoOwners = {
  bottleId: string | null;
  tastingNoteId: string | null;
  drinkLogId: string | null;
};

function toIso(value: Date | number): string {
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

export function toPhotoMeta(row: typeof photos.$inferSelect): PhotoMeta {
  return {
    id: row.id,
    contentType: asContentType(row.contentType),
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    bottleId: row.bottleId,
    tastingNoteId: row.tastingNoteId,
    drinkLogId: row.drinkLogId,
    kind: row.kind,
    sortOrder: row.sortOrder,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function ownerCount(owners: PhotoOwners): number {
  return photoOwnerIds(owners).length;
}

function assertSingleOwner(owners: PhotoOwners): void {
  if (ownerCount(owners) > 1) {
    throw new ApiError("validation_error", {
      fields: { "": [PHOTO_SINGLE_OWNER_MESSAGE] },
    });
  }
}

function inspectOrThrow(bytes: Uint8Array) {
  try {
    return inspectImageBytes(bytes);
  } catch (error) {
    if (error instanceof ImageInspectFailure) {
      if (error.code === "payload_too_large") {
        throw new ApiError("payload_too_large");
      }
      if (error.code === "unsupported_media_type") {
        throw new ApiError("unsupported_media_type");
      }
      throw new ApiError("validation_error", {
        fields: { file: ["画像のサイズが大きすぎます"] },
      });
    }
    throw error;
  }
}

async function assertOwnedRow(
  db: AppSqliteDb,
  userId: string,
  table: typeof bottles | typeof tastingNotes | typeof drinkLogs,
  id: string | null,
): Promise<void> {
  if (!id) {
    return;
  }
  if (table === bottles) {
    await requireAccessibleBottle(db, userId, id);
    return;
  }
  const owned = table === tastingNotes ? tastingNotes : drinkLogs;
  const [row] = await db
    .select({ id: owned.id })
    .from(owned)
    .where(and(eq(owned.id, id), eq(owned.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
}

export function normalizeUploadOwners(fields: PhotoUploadFields): PhotoOwners {
  return {
    bottleId: fields.bottleId ?? null,
    tastingNoteId: fields.tastingNoteId ?? null,
    drinkLogId: fields.drinkLogId ?? null,
  };
}

export function mergePatchOwners(current: PhotoOwners, patch: PhotoPatchInput): PhotoOwners {
  return {
    bottleId: patch.bottleId === undefined ? current.bottleId : patch.bottleId,
    tastingNoteId: patch.tastingNoteId === undefined ? current.tastingNoteId : patch.tastingNoteId,
    drinkLogId: patch.drinkLogId === undefined ? current.drinkLogId : patch.drinkLogId,
  };
}

async function assertOwnResource(
  db: AppSqliteDb,
  userId: string,
  owners: PhotoOwners,
): Promise<void> {
  await assertOwnedRow(db, userId, bottles, owners.bottleId);
  await assertOwnedRow(db, userId, tastingNotes, owners.tastingNoteId);
  await assertOwnedRow(db, userId, drinkLogs, owners.drinkLogId);
}

type OwnerColumn = typeof photos.bottleId | typeof photos.tastingNoteId | typeof photos.drinkLogId;

type OwnerCapacityCheck = {
  ownerId: string | null;
  column: OwnerColumn;
  limit: number;
  field: "bottleId" | "tastingNoteId" | "drinkLogId";
  message: string;
};

async function assertOwnerCapacity(
  db: AppSqliteDb,
  userId: string,
  owners: PhotoOwners,
  exceptPhotoId?: string,
): Promise<void> {
  const checks: OwnerCapacityCheck[] = [
    {
      ownerId: owners.bottleId,
      column: photos.bottleId,
      limit: PHOTO_OWNER_LIMITS.bottle,
      field: "bottleId",
      message: "このボトルにはすでに写真があります",
    },
    {
      ownerId: owners.tastingNoteId,
      column: photos.tastingNoteId,
      limit: PHOTO_OWNER_LIMITS.tastingNote,
      field: "tastingNoteId",
      message: "ノートの写真は6枚までです",
    },
    {
      ownerId: owners.drinkLogId,
      column: photos.drinkLogId,
      limit: PHOTO_OWNER_LIMITS.drinkLog,
      field: "drinkLogId",
      message: "この記録にはすでに写真があります",
    },
  ];

  await Promise.all(
    checks.map(async (check) => {
      const ownerId = check.ownerId;
      if (!ownerId) {
        return;
      }
      const current =
        check.field === "bottleId"
          ? await db.select({ id: photos.id }).from(photos).where(eq(check.column, ownerId))
          : await db
              .select({ id: photos.id })
              .from(photos)
              .where(and(eq(photos.userId, userId), eq(check.column, ownerId)));
      const used = current.filter((item) => item.id !== exceptPhotoId).length;
      if (used >= check.limit) {
        throw new ApiError("validation_error", {
          fields: { [check.field]: [check.message] },
        });
      }
    }),
  );
}

export async function assertPhotoDailyLimit(input: {
  db: AppSqliteDb;
  userId: string;
  limit?: number;
  now?: Date;
}): Promise<void> {
  const limit = input.limit ?? PHOTO_UPLOAD_DAILY_LIMIT;
  const start = new Date(tokyoDayStartMs(tokyoToday(input.now)));
  const [row] = await input.db
    .select({ total: count() })
    .from(photos)
    .where(and(eq(photos.uploadedBy, input.userId), gte(photos.createdAt, start)));
  if ((row?.total ?? 0) >= limit) {
    throw new ApiError("rate_limited");
  }
}

export async function createPhoto(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  bytes: Uint8Array;
  fields: PhotoUploadFields;
  dailyLimit?: number;
  now?: Date;
}): Promise<PhotoMeta> {
  const inspected = inspectOrThrow(input.bytes);

  const owners = normalizeUploadOwners(input.fields);
  assertSingleOwner(owners);

  const [bottle] = await Promise.all([
    owners.bottleId
      ? requireAccessibleBottle(input.db, input.userId, owners.bottleId)
      : Promise.resolve(null),
    assertOwnedRow(input.db, input.userId, tastingNotes, owners.tastingNoteId),
    assertOwnedRow(input.db, input.userId, drinkLogs, owners.drinkLogId),
    assertPhotoDailyLimit({
      db: input.db,
      userId: input.userId,
      limit: input.dailyLimit,
      now: input.now,
    }),
    assertOwnerCapacity(input.db, input.userId, owners),
  ]);

  let cellarId: string | null = null;
  let ownerUserId: string | null = input.userId;
  if (owners.bottleId) {
    if (!bottle) {
      throw new ApiError("not_found");
    }
    cellarId = bottle.cellarId;
    ownerUserId = null;
  }

  const id = crypto.randomUUID();
  const r2Key = `${id}.${inspected.extension}`;
  const now = input.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + PHOTO_RESERVATION_LEASE_MS);
  const row = {
    id,
    userId: ownerUserId,
    cellarId,
    uploadedBy: input.userId,
    r2Key,
    contentType: inspected.contentType,
    byteSize: input.bytes.byteLength,
    width: inspected.width,
    height: inspected.height,
    bottleId: owners.bottleId,
    tastingNoteId: owners.tastingNoteId,
    drinkLogId: owners.drinkLogId,
    kind: inspected.kind,
    sortOrder: input.fields.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await input.db.insert(photoObjectReservations).values({
    r2Key,
    userId: input.userId,
    leaseUntil,
    createdAt: now,
  });

  const [aliveRows, heldRows] = await Promise.all([
    input.db.select({ id: user.id }).from(user).where(eq(user.id, input.userId)),
    input.db
      .select({ r2Key: photoObjectReservations.r2Key })
      .from(photoObjectReservations)
      .where(
        and(
          eq(photoObjectReservations.r2Key, r2Key),
          eq(photoObjectReservations.userId, input.userId),
          gte(photoObjectReservations.leaseUntil, now),
        ),
      ),
  ]);
  const alive = aliveRows[0];
  const held = heldRows[0];
  if (!alive || !held) {
    await input.db.delete(photoObjectReservations).where(eq(photoObjectReservations.r2Key, r2Key));
    throw new ApiError("unauthorized");
  }

  try {
    await input.bucket.put(r2Key, input.bytes, {
      httpMetadata: { contentType: inspected.contentType },
    });
  } catch (error) {
    await input.db.delete(photoObjectReservations).where(eq(photoObjectReservations.r2Key, r2Key));
    throw error;
  }

  try {
    await input.db.batch([
      input.db.insert(photos).values(row),
      input.db.delete(photoObjectReservations).where(eq(photoObjectReservations.r2Key, r2Key)),
    ]);
  } catch (error) {
    try {
      await deletePhotoR2Objects(input.bucket, r2Key);
    } catch {
      // 予約が残れば scheduled が回収する
    }
    throw error;
  }

  await persistPhotoThumb({
    db: input.db,
    photoId: id,
    bucket: input.bucket,
    r2Key,
    kind: inspected.kind,
    contentType: inspected.contentType,
    bytes: input.bytes,
  });

  if (owners.bottleId && bottle) {
    await touchBottlePhoto(input.db, input.userId, owners.bottleId, now, bottle);
  }

  return toPhotoMeta(row);
}

export async function getOwnPhoto(
  db: AppSqliteDb,
  userId: string,
  photoId: string,
): Promise<typeof photos.$inferSelect> {
  const [row] = await db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.id, photoId),
        or(
          and(eq(photos.userId, userId), isNull(photos.cellarId)),
          sql`${photos.cellarId} IN (SELECT cellar_id FROM ${cellarMembers} WHERE ${cellarMembers.userId} = ${userId})`,
        ),
      ),
    );
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

export async function updatePhoto(input: {
  db: AppBatchDb;
  userId: string;
  photoId: string;
  patch: PhotoPatchInput;
}): Promise<PhotoMeta> {
  const current = await getOwnPhoto(input.db, input.userId, input.photoId);
  const owners = mergePatchOwners(
    {
      bottleId: current.bottleId,
      tastingNoteId: current.tastingNoteId,
      drinkLogId: current.drinkLogId,
    },
    input.patch,
  );
  assertSingleOwner(owners);
  await assertOwnResource(input.db, input.userId, owners);
  await assertOwnerCapacity(input.db, input.userId, owners, input.photoId);

  const now = new Date();
  let cellarId = current.cellarId;
  let ownerUserId = current.userId;
  if (owners.bottleId) {
    const bottle = await requireAccessibleBottle(input.db, input.userId, owners.bottleId);
    cellarId = bottle.cellarId;
    ownerUserId = null;
  } else if (owners.tastingNoteId || owners.drinkLogId) {
    cellarId = null;
    ownerUserId = input.userId;
  } else if (current.bottleId && !owners.bottleId) {
    cellarId = null;
    ownerUserId = input.userId;
  }

  await input.db
    .update(photos)
    .set({
      bottleId: owners.bottleId,
      tastingNoteId: owners.tastingNoteId,
      drinkLogId: owners.drinkLogId,
      cellarId,
      userId: ownerUserId,
      sortOrder: input.patch.sortOrder ?? current.sortOrder,
      updatedAt: now,
    })
    .where(eq(photos.id, input.photoId));

  if (owners.bottleId && owners.bottleId !== current.bottleId) {
    await touchBottlePhoto(input.db, input.userId, owners.bottleId, now);
  } else if (current.bottleId && current.bottleId !== owners.bottleId) {
    await touchBottlePhoto(input.db, input.userId, current.bottleId, now);
  }

  return toPhotoMeta({
    ...current,
    ...owners,
    cellarId,
    userId: ownerUserId,
    sortOrder: input.patch.sortOrder ?? current.sortOrder,
    updatedAt: now,
  });
}

export async function deletePhoto(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  photoId: string;
}): Promise<void> {
  const row = await getOwnPhoto(input.db, input.userId, input.photoId);
  try {
    await deletePhotoR2Objects(input.bucket, row.r2Key);
  } catch {
    throw new ApiError("internal_error");
  }
  await input.db.delete(photos).where(eq(photos.id, input.photoId));
  if (row.bottleId) {
    await touchBottlePhoto(input.db, input.userId, row.bottleId);
  }
}

async function touchBottlePhoto(
  db: AppBatchDb,
  userId: string,
  bottleId: string,
  now: Date = new Date(),
  known?: AccessibleBottle,
): Promise<void> {
  const current = known ?? (await requireAccessibleBottle(db, userId, bottleId));
  await db.batch([
    db
      .update(bottles)
      .set({
        version: current.version + 1,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(bottles.id, bottleId)),
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

/**
 * 端末保存は可。表示のたびに認可後再検証する。
 * 削除後に本文を再検証なしで出さない。1 年 immutable には戻さない。
 */
export const PHOTO_CONTENT_CACHE_CONTROL = "private, no-cache";

/** ETag は写真 id（と派生）だけから作る。userId や r2Key は含めない */
export function photoContentEtag(photoId: string, variant?: "thumb"): string {
  return variant === "thumb" ? `"${photoId}:thumb"` : `"${photoId}"`;
}

/** `If-None-Match` の一覧（`W/` 弱比較・`*` 含む）に ETag が含まれるか */
export function matchesIfNoneMatch(header: string | undefined, etag: string): boolean {
  if (!header) {
    return false;
  }
  return header.split(",").some((raw) => {
    const value = raw.trim();
    if (value === "*") {
      return true;
    }
    return (value.startsWith("W/") ? value.slice(2) : value) === etag;
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function persistPhotoThumb(input: {
  db?: AppSqliteDb | AppBatchDb;
  photoId?: string;
  bucket: PhotoBucket;
  r2Key: string;
  kind: PhotoKind;
  contentType: PhotoContentType;
  bytes: Uint8Array;
}): Promise<GeneratedPhotoThumb | null> {
  const thumb = await generatePhotoThumb(input.bytes, input.contentType, input.kind);
  if (!thumb) {
    return null;
  }
  if (input.db && input.photoId) {
    const [row] = await input.db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.id, input.photoId));
    if (!row) {
      return null;
    }
  }
  try {
    await input.bucket.put(photoThumbR2Key(input.r2Key, input.kind), thumb.bytes, {
      httpMetadata: { contentType: thumb.contentType },
    });
  } catch {
    // 初回 GET で作り直す
  }
  return thumb;
}

/** `getOwnPhoto` で所有確認した行の本文を R2 から読む。行を渡す側が userId 一致を保証する */
export async function readOwnedPhotoContent(
  db: AppSqliteDb | AppBatchDb,
  bucket: PhotoBucket,
  row: Pick<typeof photos.$inferSelect, "id" | "r2Key" | "contentType" | "kind">,
  variant?: "thumb",
): Promise<{ body: ArrayBuffer; contentType: string; kind: PhotoKind }> {
  if (variant !== "thumb") {
    const object = await bucket.get(row.r2Key);
    if (!object) {
      throw new ApiError("not_found");
    }
    return {
      body: await object.arrayBuffer(),
      contentType: row.contentType,
      kind: row.kind,
    };
  }

  const thumbKey = photoThumbR2Key(row.r2Key, row.kind);
  const existing = await bucket.get(thumbKey);
  if (existing) {
    return {
      body: await existing.arrayBuffer(),
      contentType: existing.contentType ?? photoThumbContentType(row.kind),
      kind: row.kind,
    };
  }

  const original = await bucket.get(row.r2Key);
  if (!original) {
    throw new ApiError("not_found");
  }
  const bytes = new Uint8Array(await original.arrayBuffer());
  const thumb = await persistPhotoThumb({
    db,
    photoId: row.id,
    bucket,
    r2Key: row.r2Key,
    kind: row.kind,
    contentType: asContentType(row.contentType),
    bytes,
  });
  if (thumb) {
    return {
      body: toArrayBuffer(thumb.bytes),
      contentType: thumb.contentType,
      kind: row.kind,
    };
  }
  return {
    body: toArrayBuffer(bytes),
    contentType: row.contentType,
    kind: row.kind,
  };
}
