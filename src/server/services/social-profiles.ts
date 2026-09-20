import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import {
  friendInvitations,
  friendRequests,
  socialAvatars,
  socialPreferences,
  socialProfiles,
} from "@/db/schema.ts";
import {
  DEFAULT_MASCOT_COLOR,
  mascotColorSchema,
  SOCIAL_AVATAR_MAX_BYTES,
  type SocialMe,
  type SocialPreferences,
  type SocialProfilePatch,
} from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import type { PhotoBucket } from "./photos.ts";
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";
import {
  fallbackProfile,
  getOrCreatePreferences,
  getSocialProfile,
  listActiveFriendIds,
  toPublicProfile,
} from "./social-access.ts";

export type { SocialProfilePatch } from "@/shared/social.ts";

export async function getSocialMe(db: AppBatchDb, userId: string): Promise<SocialMe> {
  const profile = await getSocialProfile(db, userId);
  const friends = await listActiveFriendIds(db, userId);
  if (!profile) {
    return {
      ...fallbackProfile(userId),
      nickname: "",
      profileCompleted: false,
      friendCount: friends.length,
    };
  }
  return {
    ...toPublicProfile(profile),
    profileCompleted: true,
    friendCount: friends.length,
  };
}

export async function updateSocialProfile(
  db: AppBatchDb,
  userId: string,
  patch: { nickname?: string; avatarMode?: "mascot" | "uploaded"; mascotColor?: string },
  now = new Date(),
): Promise<SocialMe> {
  const current = await getSocialProfile(db, userId);
  const nickname = patch.nickname ?? current?.nickname;
  if (!nickname) {
    throw new ApiError("validation_error", {
      fields: { nickname: ["友達に表示する名前を入力してください"] },
    });
  }
  const mascotColor = mascotColorSchema.parse(patch.mascotColor ?? current?.mascotColor ?? DEFAULT_MASCOT_COLOR);
  let avatarMode = patch.avatarMode ?? current?.avatarMode ?? "mascot";
  let avatarId = current?.avatarId ?? null;
  if (avatarMode === "uploaded" && !avatarId) {
    avatarMode = "mascot";
  }
  if (avatarMode === "mascot") {
    avatarId = current?.avatarId ?? null;
  }
  if (current) {
    await db
      .update(socialProfiles)
      .set({
        nickname,
        avatarMode,
        mascotColor,
        avatarId,
        updatedAt: now,
      })
      .where(eq(socialProfiles.userId, userId));
  } else {
    await db.insert(socialProfiles).values({
      userId,
      nickname,
      avatarMode,
      mascotColor,
      avatarId,
      profileCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  return getSocialMe(db, userId);
}

export async function getSocialPreferences(
  db: AppBatchDb,
  userId: string,
): Promise<SocialPreferences> {
  const row = await getOrCreatePreferences(db, userId);
  return { shareDefaultOn: row.shareDefaultOn };
}

export async function updateSocialPreferences(
  db: AppBatchDb,
  userId: string,
  shareDefaultOn: boolean,
  now = new Date(),
): Promise<SocialPreferences> {
  await getOrCreatePreferences(db, userId, now);
  await db
    .update(socialPreferences)
    .set({ shareDefaultOn, updatedAt: now })
    .where(eq(socialPreferences.userId, userId));
  return { shareDefaultOn };
}

export async function uploadSocialAvatar(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  bytes: Uint8Array;
  now?: Date;
}): Promise<SocialMe> {
  const now = input.now ?? new Date();
  await requireCompletedOrCreatePlaceholder(input.db, input.userId, now);
  let inspected;
  try {
    inspected = inspectImageBytes(input.bytes, {
      maxBytes: SOCIAL_AVATAR_MAX_BYTES,
      maxLongEdge: 2048,
    });
  } catch (error) {
    if (error instanceof ImageInspectFailure) {
      if (error.code === "payload_too_large") {
        throw new ApiError("payload_too_large");
      }
      if (error.code === "unsupported_media_type") {
        throw new ApiError("unsupported_media_type");
      }
      throw new ApiError("validation_error", {
        fields: { file: ["画像の形式が正しくありません"] },
      });
    }
    throw error;
  }
  const current = await getSocialProfile(input.db, input.userId);
  const avatarId = crypto.randomUUID();
  const r2Key = `avatars/${avatarId}.jpg`;
  await input.bucket.put(r2Key, input.bytes, {
    httpMetadata: { contentType: inspected.contentType },
  });
  try {
    await input.db.insert(socialAvatars).values({
      id: avatarId,
      userId: input.userId,
      r2Key,
      contentType: inspected.contentType,
      byteSize: input.bytes.byteLength,
      width: inspected.width,
      height: inspected.height,
      createdAt: now,
    });
    await input.db
      .update(socialProfiles)
      .set({
        avatarMode: "uploaded",
        avatarId,
        updatedAt: now,
      })
      .where(eq(socialProfiles.userId, input.userId));
  } catch (error) {
    await deletePhotoR2Objects(input.bucket, r2Key).catch(() => undefined);
    throw error;
  }
  if (current?.avatarId && current.avatarId !== avatarId) {
    await retireAvatar(input.db, input.bucket, current.avatarId);
  }
  return getSocialMe(input.db, input.userId);
}

export async function deleteSocialAvatar(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  userId: string;
  now?: Date;
}): Promise<SocialMe> {
  const now = input.now ?? new Date();
  const current = await getSocialProfile(input.db, input.userId);
  if (!current) {
    throw new ApiError("not_found");
  }
  await input.db
    .update(socialProfiles)
    .set({
      avatarMode: "mascot",
      updatedAt: now,
    })
    .where(eq(socialProfiles.userId, input.userId));
  if (current.avatarId) {
    await retireAvatar(input.db, input.bucket, current.avatarId);
  }
  return getSocialMe(input.db, input.userId);
}

async function retireAvatar(db: AppBatchDb, bucket: PhotoBucket, avatarId: string) {
  const [row] = await db.select().from(socialAvatars).where(eq(socialAvatars.id, avatarId));
  if (!row) {
    return;
  }
  try {
    await deletePhotoR2Objects(bucket, row.r2Key);
    await db.delete(socialAvatars).where(eq(socialAvatars.id, avatarId));
  } catch {
    await db
      .update(socialProfiles)
      .set({ avatarId: null })
      .where(eq(socialProfiles.avatarId, avatarId));
  }
}

async function requireCompletedOrCreatePlaceholder(db: AppBatchDb, userId: string, now: Date) {
  const current = await getSocialProfile(db, userId);
  if (current) {
    return current;
  }
  throw new ApiError("conflict", {
    fields: { "": ["友達に表示する名前を先に設定してください"] },
    conflict: { reason: "profile_incomplete" },
  });
}

export async function canReadAvatar(
  db: AppBatchDb,
  viewerId: string,
  ownerId: string,
): Promise<boolean> {
  if (viewerId === ownerId) {
    return true;
  }
  const friends = await listActiveFriendIds(db, viewerId);
  if (friends.includes(ownerId)) {
    return true;
  }
  const [request] = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "pending"),
        or(
          and(eq(friendRequests.requesterUserId, viewerId), eq(friendRequests.recipientUserId, ownerId)),
          and(eq(friendRequests.requesterUserId, ownerId), eq(friendRequests.recipientUserId, viewerId)),
        ),
      ),
    );
  if (request) {
    return true;
  }
  const [invite] = await db
    .select({ id: friendInvitations.id })
    .from(friendInvitations)
    .where(
      and(
        eq(friendInvitations.ownerUserId, ownerId),
        isNull(friendInvitations.revokedAt),
        gt(friendInvitations.expiresAt, new Date()),
      ),
    );
  return Boolean(invite);
}

export async function readAvatarContent(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  viewerId: string;
  ownerId: string;
}): Promise<{ body: Uint8Array; contentType: string }> {
  if (!(await canReadAvatar(input.db, input.viewerId, input.ownerId))) {
    throw new ApiError("not_found");
  }
  const profile = await getSocialProfile(input.db, input.ownerId);
  if (!profile?.avatarId || profile.avatarMode !== "uploaded") {
    throw new ApiError("not_found");
  }
  const [avatar] = await input.db
    .select()
    .from(socialAvatars)
    .where(eq(socialAvatars.id, profile.avatarId));
  if (!avatar) {
    throw new ApiError("not_found");
  }
  const object = await input.bucket.get(avatar.r2Key);
  if (!object) {
    throw new ApiError("not_found");
  }
  return {
    body: new Uint8Array(await object.arrayBuffer()),
    contentType: avatar.contentType,
  };
}
