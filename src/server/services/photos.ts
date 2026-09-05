import { and, eq } from "drizzle-orm";
import type { AppSqliteDb } from "@/db/index.ts";
import { bottles, drinkLogs, photos, tastingNotes } from "@/db/schema.ts";
import {
  PHOTO_CONTENT_TYPES,
  PHOTO_OWNER_LIMITS,
  type PhotoContentType,
  type PhotoKind,
} from "@/shared/constants.ts";
import type { PhotoMeta, PhotoPatchInput, PhotoUploadFields } from "@/shared/photos.ts";
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
  return [owners.bottleId, owners.tastingNoteId, owners.drinkLogId].filter(
    (id): id is string => typeof id === "string",
  ).length;
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
  if (owners.bottleId) {
    const [row] = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(and(eq(bottles.id, owners.bottleId), eq(bottles.userId, userId)));
    if (!row) {
      throw new ApiError("not_found");
    }
  }
  if (owners.tastingNoteId) {
    const [row] = await db
      .select({ id: tastingNotes.id })
      .from(tastingNotes)
      .where(and(eq(tastingNotes.id, owners.tastingNoteId), eq(tastingNotes.userId, userId)));
    if (!row) {
      throw new ApiError("not_found");
    }
  }
  if (owners.drinkLogId) {
    const [row] = await db
      .select({ id: drinkLogs.id })
      .from(drinkLogs)
      .where(and(eq(drinkLogs.id, owners.drinkLogId), eq(drinkLogs.userId, userId)));
    if (!row) {
      throw new ApiError("not_found");
    }
  }
}

async function assertOwnerCapacity(
  db: AppSqliteDb,
  userId: string,
  owners: PhotoOwners,
  exceptPhotoId?: string,
): Promise<void> {
  if (owners.bottleId) {
    const current = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.bottleId, owners.bottleId)));
    const used = current.filter((item) => item.id !== exceptPhotoId).length;
    if (used >= PHOTO_OWNER_LIMITS.bottle) {
      throw new ApiError("validation_error", {
        fields: { bottleId: ["このボトルにはすでに写真があります"] },
      });
    }
  }
  if (owners.tastingNoteId) {
    const current = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.tastingNoteId, owners.tastingNoteId)));
    const used = current.filter((item) => item.id !== exceptPhotoId).length;
    if (used >= PHOTO_OWNER_LIMITS.tastingNote) {
      throw new ApiError("validation_error", {
        fields: { tastingNoteId: ["ノートの写真は6枚までです"] },
      });
    }
  }
  if (owners.drinkLogId) {
    const current = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.drinkLogId, owners.drinkLogId)));
    const used = current.filter((item) => item.id !== exceptPhotoId).length;
    if (used >= PHOTO_OWNER_LIMITS.drinkLog) {
      throw new ApiError("validation_error", {
        fields: { drinkLogId: ["この記録にはすでに写真があります"] },
      });
    }
  }
}

export async function createPhoto(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  userId: string;
  bytes: Uint8Array;
  fields: PhotoUploadFields;
}): Promise<PhotoMeta> {
  let inspected: ReturnType<typeof inspectImageBytes>;
  try {
    inspected = inspectImageBytes(input.bytes);
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

  const owners = normalizeUploadOwners(input.fields);
  if (ownerCount(owners) > 1) {
    throw new ApiError("validation_error", {
      fields: { "": ["紐付け先は1つまでにしてください"] },
    });
  }
  await assertOwnResource(input.db, input.userId, owners);
  await assertOwnerCapacity(input.db, input.userId, owners);

  const id = crypto.randomUUID();
  const r2Key = `${id}.${inspected.extension}`;
  const now = new Date();

  await input.bucket.put(r2Key, input.bytes, {
    httpMetadata: { contentType: inspected.contentType },
  });

  try {
    await input.db.insert(photos).values({
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
    });
  } catch (error) {
    await input.bucket.delete(r2Key);
    throw error;
  }

  return toPhotoMeta({
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
  });
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
  if (ownerCount(owners) > 1) {
    throw new ApiError("validation_error", {
      fields: { "": ["紐付け先は1つまでにしてください"] },
    });
  }
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

export async function readPhotoContent(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  userId: string;
  photoId: string;
}): Promise<{ body: ArrayBuffer; contentType: string; kind: PhotoKind }> {
  const row = await getOwnPhoto(input.db, input.userId, input.photoId);
  const object = await input.bucket.get(row.r2Key);
  if (!object) {
    throw new ApiError("not_found");
  }
  return {
    body: await object.arrayBuffer(),
    contentType: row.contentType,
    kind: row.kind,
  };
}
