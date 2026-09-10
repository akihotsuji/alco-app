import { and, count, eq, gte } from "drizzle-orm";
import type { AppSqliteDb } from "@/db/index.ts";
import { bottles, drinkLogs, photos, tastingNotes } from "@/db/schema.ts";
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
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";

export type PhotoObject = {
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type PhotoBucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<PhotoObject | null>;
  delete(key: string): Promise<void>;
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
      return { arrayBuffer: () => object.arrayBuffer() };
    },
    async delete(key) {
      await bucket.delete(key);
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
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)));
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

  for (const check of checks) {
    if (!check.ownerId) {
      continue;
    }
    const current = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(check.column, check.ownerId)));
    const used = current.filter((item) => item.id !== exceptPhotoId).length;
    if (used >= check.limit) {
      throw new ApiError("validation_error", {
        fields: { [check.field]: [check.message] },
      });
    }
  }
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
    .where(and(eq(photos.userId, input.userId), gte(photos.createdAt, start)));
  if ((row?.total ?? 0) >= limit) {
    throw new ApiError("rate_limited");
  }
}

export async function createPhoto(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  userId: string;
  bytes: Uint8Array;
  fields: PhotoUploadFields;
  dailyLimit?: number;
  now?: Date;
}): Promise<PhotoMeta> {
  await assertPhotoDailyLimit({
    db: input.db,
    userId: input.userId,
    limit: input.dailyLimit,
    now: input.now,
  });
  const inspected = inspectOrThrow(input.bytes);

  const owners = normalizeUploadOwners(input.fields);
  assertSingleOwner(owners);
  await assertOwnResource(input.db, input.userId, owners);
  await assertOwnerCapacity(input.db, input.userId, owners);

  const id = crypto.randomUUID();
  const r2Key = `${id}.${inspected.extension}`;
  const now = new Date();
  const row = {
    id,
    userId: input.userId,
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

  await input.bucket.put(r2Key, input.bytes, {
    httpMetadata: { contentType: inspected.contentType },
  });

  try {
    await input.db.insert(photos).values(row);
  } catch (error) {
    await input.bucket.delete(r2Key);
    throw error;
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
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

export async function updatePhoto(input: {
  db: AppSqliteDb;
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
  await input.db
    .update(photos)
    .set({
      bottleId: owners.bottleId,
      tastingNoteId: owners.tastingNoteId,
      drinkLogId: owners.drinkLogId,
      sortOrder: input.patch.sortOrder ?? current.sortOrder,
      updatedAt: now,
    })
    .where(and(eq(photos.id, input.photoId), eq(photos.userId, input.userId)));

  return toPhotoMeta({
    ...current,
    ...owners,
    sortOrder: input.patch.sortOrder ?? current.sortOrder,
    updatedAt: now,
  });
}

export async function deletePhoto(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  userId: string;
  photoId: string;
}): Promise<void> {
  const row = await getOwnPhoto(input.db, input.userId, input.photoId);
  try {
    await input.bucket.delete(row.r2Key);
  } catch {
    throw new ApiError("internal_error");
  }
  await input.db
    .delete(photos)
    .where(and(eq(photos.id, input.photoId), eq(photos.userId, input.userId)));
}

/**
 * 写真本文は不変（`r2Key` / `contentType` は作成後に変わらず、差し替えは別 id の新規作成）。
 * `private` で共有キャッシュには載せず、ブラウザだけが長く持つ。再訪の棚・ノート一覧で
 * 認可付き GET（session + D1 + R2 の往復）を毎回やり直さないためのもの。
 */
export const PHOTO_CONTENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const PHOTO_CONTENT_CACHE_CONTROL = `private, max-age=${PHOTO_CONTENT_MAX_AGE_SECONDS}, immutable`;

/** ETag は写真 id だけから作る（R2 の etag を読みに行かない）。userId や r2Key は含めない */
export function photoContentEtag(photoId: string): string {
  return `"${photoId}"`;
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

/** `getOwnPhoto` で所有確認した行の本文を R2 から読む。行を渡す側が userId 一致を保証する */
export async function readOwnedPhotoBody(
  bucket: PhotoBucket,
  row: Pick<typeof photos.$inferSelect, "r2Key" | "contentType" | "kind">,
): Promise<{ body: ArrayBuffer; contentType: string; kind: PhotoKind }> {
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
