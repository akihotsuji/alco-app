import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import {
  friendshipEpochs,
  socialBlocks,
  socialPostRecipients,
  socialPosts,
  socialPreferences,
  socialProfiles,
  user,
} from "@/db/schema.ts";
import {
  DEFAULT_MASCOT_COLOR,
  resolvePublicDisplayName,
  type SocialPublicProfile,
} from "@/shared/social.ts";
import { ApiError } from "../errors.ts";

export function pairIds(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export async function getActiveEpoch(db: AppBatchDb, userA: string, userB: string) {
  const { low, high } = pairIds(userA, userB);
  const [row] = await db
    .select()
    .from(friendshipEpochs)
    .where(
      and(
        eq(friendshipEpochs.userLowId, low),
        eq(friendshipEpochs.userHighId, high),
        isNull(friendshipEpochs.endedAt),
      ),
    );
  return row ?? null;
}

export async function listActiveFriendIds(db: AppBatchDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({
      low: friendshipEpochs.userLowId,
      high: friendshipEpochs.userHighId,
    })
    .from(friendshipEpochs)
    .where(
      and(
        isNull(friendshipEpochs.endedAt),
        or(eq(friendshipEpochs.userLowId, userId), eq(friendshipEpochs.userHighId, userId)),
      ),
    );
  return rows.map((row) => (row.low === userId ? row.high : row.low));
}

export async function isBlockedEitherWay(
  db: AppBatchDb,
  userA: string,
  userB: string,
): Promise<boolean> {
  const [row] = await db
    .select({ blocker: socialBlocks.blockerUserId })
    .from(socialBlocks)
    .where(
      or(
        and(eq(socialBlocks.blockerUserId, userA), eq(socialBlocks.blockedUserId, userB)),
        and(eq(socialBlocks.blockerUserId, userB), eq(socialBlocks.blockedUserId, userA)),
      ),
    );
  return Boolean(row);
}

export async function getSocialProfile(db: AppBatchDb, userId: string) {
  const [row] = await db.select().from(socialProfiles).where(eq(socialProfiles.userId, userId));
  return row ?? null;
}

export async function getOrCreatePreferences(db: AppBatchDb, userId: string, now = new Date()) {
  const [existing] = await db
    .select()
    .from(socialPreferences)
    .where(eq(socialPreferences.userId, userId));
  if (existing) {
    return existing;
  }
  await db.insert(socialPreferences).values({
    userId,
    shareDefaultOn: true,
    updatedAt: now,
  });
  const [created] = await db
    .select()
    .from(socialPreferences)
    .where(eq(socialPreferences.userId, userId));
  return created ?? { userId, shareDefaultOn: true, updatedAt: now };
}

export function toPublicProfile(input: {
  userId: string;
  accountName?: string | null;
  avatarMode?: "mascot" | "uploaded" | null;
  mascotColor?: string | null;
  avatarId?: string | null;
}): SocialPublicProfile {
  const uploaded = input.avatarMode === "uploaded" && Boolean(input.avatarId);
  return {
    userId: input.userId,
    nickname: resolvePublicDisplayName(input.accountName),
    avatarMode: uploaded ? "uploaded" : "mascot",
    mascotColor: input.mascotColor || DEFAULT_MASCOT_COLOR,
    hasCustomAvatar: uploaded,
  };
}

export async function loadProfiles(
  db: AppBatchDb,
  userIds: readonly string[],
): Promise<Map<string, SocialPublicProfile>> {
  const unique = [...new Set(userIds)];
  const map = new Map<string, SocialPublicProfile>();
  if (unique.length === 0) {
    return map;
  }
  const rows = await db
    .select({
      userId: user.id,
      accountName: user.name,
      avatarMode: socialProfiles.avatarMode,
      mascotColor: socialProfiles.mascotColor,
      avatarId: socialProfiles.avatarId,
    })
    .from(user)
    .leftJoin(socialProfiles, eq(socialProfiles.userId, user.id))
    .where(inArray(user.id, unique));
  for (const row of rows) {
    map.set(row.userId, toPublicProfile(row));
  }
  return map;
}

export async function loadPublicProfile(
  db: AppBatchDb,
  userId: string,
): Promise<SocialPublicProfile | null> {
  const map = await loadProfiles(db, [userId]);
  return map.get(userId) ?? null;
}

export function fallbackProfile(userId: string): SocialPublicProfile {
  return {
    userId,
    nickname: resolvePublicDisplayName(""),
    avatarMode: "mascot",
    mascotColor: DEFAULT_MASCOT_COLOR,
    hasCustomAvatar: false,
  };
}

export async function canViewSocialPost(
  db: AppBatchDb,
  viewerId: string,
  postId: string,
): Promise<boolean> {
  const [post] = await db
    .select({
      id: socialPosts.id,
      authorUserId: socialPosts.authorUserId,
    })
    .from(socialPosts)
    .where(eq(socialPosts.id, postId));
  if (!post) {
    return false;
  }
  if (post.authorUserId === viewerId) {
    return true;
  }
  const [recipient] = await db
    .select({
      epochEnded: friendshipEpochs.endedAt,
    })
    .from(socialPostRecipients)
    .innerJoin(friendshipEpochs, eq(friendshipEpochs.id, socialPostRecipients.friendshipEpochId))
    .where(
      and(eq(socialPostRecipients.postId, postId), eq(socialPostRecipients.viewerUserId, viewerId)),
    );
  if (!recipient || recipient.epochEnded) {
    return false;
  }
  return !(await isBlockedEitherWay(db, viewerId, post.authorUserId));
}

export async function requireViewablePost(db: AppBatchDb, viewerId: string, postId: string) {
  const allowed = await canViewSocialPost(db, viewerId, postId);
  if (!allowed) {
    throw new ApiError("not_found");
  }
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  if (!post) {
    throw new ApiError("not_found");
  }
  return post;
}

export async function listActiveFriendEpochs(db: AppBatchDb, userId: string) {
  return db
    .select()
    .from(friendshipEpochs)
    .where(
      and(
        isNull(friendshipEpochs.endedAt),
        or(eq(friendshipEpochs.userLowId, userId), eq(friendshipEpochs.userHighId, userId)),
      ),
    );
}

export function viewerIdOfEpoch(
  epoch: { userLowId: string; userHighId: string },
  authorId: string,
): string {
  return epoch.userLowId === authorId ? epoch.userHighId : epoch.userLowId;
}

export const activeRecipientSql = sql`
  ${socialPostRecipients.viewerUserId} = ${sql.placeholder("viewerId")}
  AND ${friendshipEpochs.endedAt} IS NULL
`;
