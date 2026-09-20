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
  SOCIAL_FALLBACK_DISPLAY_NAME,
  type SocialMe,
  type SocialPreferences,
} from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import { ImageInspectFailure, inspectImageBytes } from "./image-inspect.ts";
import type { PhotoBucket } from "./photos.ts";
import { deletePhotoR2Objects } from "./r2-delete.ts";
import {
  getOrCreatePreferences,
  getSocialProfile,
  listActiveFriendIds,
  loadPublicProfile,
} from "./social-access.ts";

export type { SocialProfilePatch } from "@/shared/social.ts";

export async function getSocialMe(db: AppBatchDb, userId: string): Promise<SocialMe> {
  const friends = await listActiveFriendIds(db, userId);
  const profile = await loadPublicProfile(db, userId);
  return {
    ...(profile ?? {
      userId,
      nickname: SOCIAL_FALLBACK_DISPLAY_NAME,
      avatarMode: "mascot" as const,
      mascotColor: DEFAULT_MASCOT_COLOR,
      hasCustomAvatar: false,
    }),
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
  const hasAppearanceChange = patch.mascotColor !== undefined || patch.avatarMode !== undefined;
  if (hasAppearanceChange) {
    const mascotColor = mascotColorSchema.parse(
      patch.mascotColor ?? current?.mascotColor ?? DEFAULT_MASCOT_COLOR,
    );
    let avatarMode = patch.avatarMode ?? current?.avatarMode ?? "mascot";
    const avatarId = current?.avatarId ?? null;
    if (avatarMode === "uploaded" && !avatarId) {
      avatarMode = "mascot";
    }
    await upsertSocialProfileRow(db, {
      userId,
      now,
      mascotColor,
      avatarMode,
      avatarId,
    });
  } else {
    // 旧クライアントの nickname だけは受け取り、アカウント名も専用名も上書きしない
    await upsertSocialProfileRow(db, {
      userId,
      now,
      mascotColor: current?.mascotColor ?? DEFAULT_MASCOT_COLOR,
      avatarMode: current?.avatarMode ?? "mascot",
      avatarId: current?.avatarId ?? null,
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
  await upsertSocialProfileRow(input.db, {
    userId: input.userId,
    now,
  });
  let inspected: ReturnType<typeof inspectImageBytes>;
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
    return getSocialMe(input.db, input.userId);
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

export async function upsertSocialProfileRow(
  db: AppBatchDb,
  input: {
    userId: string;
    now: Date;
    mascotColor?: string;
    avatarMode?: "mascot" | "uploaded";
    avatarId?: string | null;
  },
) {
  const current = await getSocialProfile(db, input.userId);
  if (current) {
    const next = {
      mascotColor: input.mascotColor ?? current.mascotColor,
      avatarMode: input.avatarMode ?? current.avatarMode,
      avatarId: input.avatarId === undefined ? current.avatarId : input.avatarId,
      updatedAt: input.now,
    };
    await db.update(socialProfiles).set(next).where(eq(socialProfiles.userId, input.userId));
    return;
  }
  await db
    .insert(socialProfiles)
    .values({
      userId: input.userId,
      nickname: "",
      avatarMode: input.avatarMode ?? "mascot",
      mascotColor: input.mascotColor ?? DEFAULT_MASCOT_COLOR,
      avatarId: input.avatarId ?? null,
      profileCompletedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: socialProfiles.userId,
      set: {
        mascotColor: input.mascotColor ?? DEFAULT_MASCOT_COLOR,
        updatedAt: input.now,
      },
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
          and(
            eq(friendRequests.requesterUserId, viewerId),
            eq(friendRequests.recipientUserId, ownerId),
          ),
          and(
            eq(friendRequests.requesterUserId, ownerId),
            eq(friendRequests.recipientUserId, viewerId),
          ),
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
}): Promise<{ body: ArrayBuffer; contentType: string }> {
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
    body: await object.arrayBuffer(),
    contentType: avatar.contentType,
  };
}
