import { and, eq, inArray } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { reactionTypes, socialPosts, socialReactions } from "@/db/schema.ts";
import type { ReactionType, SocialReactionSummary } from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import { canViewSocialPost } from "./social-access.ts";
import {
  deleteNotificationsByDedup,
  reactionDedupKey,
  type SocialUnreadSink,
  upsertNotification,
} from "./social-notifications.ts";
import { socialReactionRateLimiter } from "./social-rate-limit.ts";

export async function listReactionTypes(
  db: AppBatchDb,
  options: { includeInactive?: boolean } = {},
): Promise<ReactionType[]> {
  const rows = await db.select().from(reactionTypes);
  return rows
    .filter((row) => options.includeInactive || row.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((row) => ({
      id: row.id,
      code: row.code,
      emoji: row.emoji,
      label: row.label,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    }));
}

export async function putReaction(input: {
  db: AppBatchDb;
  userId: string;
  postId: string;
  reactionTypeId: string;
  now?: Date;
  onUnread?: SocialUnreadSink;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  if (!socialReactionRateLimiter.consume(input.userId, now.getTime())) {
    throw new ApiError("rate_limited");
  }
  const [post] = await input.db.select().from(socialPosts).where(eq(socialPosts.id, input.postId));
  if (!post || !(await canViewSocialPost(input.db, input.userId, input.postId))) {
    throw new ApiError("not_found");
  }
  if (post.authorUserId === input.userId) {
    throw new ApiError("not_found");
  }
  const [type] = await input.db
    .select()
    .from(reactionTypes)
    .where(eq(reactionTypes.id, input.reactionTypeId));
  if (!type?.isActive) {
    throw new ApiError("validation_error", {
      fields: { reactionTypeId: ["リアクションの指定が正しくありません"] },
    });
  }
  const [existing] = await input.db
    .select()
    .from(socialReactions)
    .where(and(eq(socialReactions.postId, input.postId), eq(socialReactions.userId, input.userId)));
  if (existing) {
    await input.db
      .update(socialReactions)
      .set({
        reactionTypeId: type.id,
        updatedAt: now,
      })
      .where(
        and(eq(socialReactions.postId, input.postId), eq(socialReactions.userId, input.userId)),
      );
  } else {
    await input.db.insert(socialReactions).values({
      postId: input.postId,
      userId: input.userId,
      reactionTypeId: type.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  await upsertNotification({
    db: input.db,
    recipientUserId: post.authorUserId,
    actorUserId: input.userId,
    type: "reaction",
    dedupKey: reactionDedupKey(input.postId, input.userId),
    targetKind: "social_post",
    targetId: input.postId,
    now,
    onUnread: input.onUnread,
  });
  return { ok: true };
}

export async function deleteReaction(input: {
  db: AppBatchDb;
  userId: string;
  postId: string;
}): Promise<{ ok: true }> {
  if (!(await canViewSocialPost(input.db, input.userId, input.postId))) {
    throw new ApiError("not_found");
  }
  await input.db
    .delete(socialReactions)
    .where(and(eq(socialReactions.postId, input.postId), eq(socialReactions.userId, input.userId)));
  const [post] = await input.db.select().from(socialPosts).where(eq(socialPosts.id, input.postId));
  if (post) {
    await deleteNotificationsByDedup(
      input.db,
      post.authorUserId,
      reactionDedupKey(input.postId, input.userId),
    );
  }
  return { ok: true };
}

export async function reactionSummariesForPosts(
  db: AppBatchDb,
  viewerId: string,
  postIds: string[],
): Promise<Map<string, SocialReactionSummary[]>> {
  const map = new Map<string, SocialReactionSummary[]>();
  if (postIds.length === 0) {
    return map;
  }
  const [types, rows] = await Promise.all([
    db.select().from(reactionTypes),
    db.select().from(socialReactions).where(inArray(socialReactions.postId, postIds)),
  ]);
  const typeById = new Map(types.map((type) => [type.id, type]));
  for (const postId of postIds) {
    const counts = new Map<string, { count: number; mine: boolean }>();
    for (const row of rows.filter((item) => item.postId === postId)) {
      const current = counts.get(row.reactionTypeId) ?? { count: 0, mine: false };
      current.count += 1;
      if (row.userId === viewerId) {
        current.mine = true;
      }
      counts.set(row.reactionTypeId, current);
    }
    const summaries: SocialReactionSummary[] = [];
    for (const [typeId, value] of counts) {
      const type = typeById.get(typeId);
      if (!type) {
        continue;
      }
      summaries.push({
        typeId: type.id,
        code: type.code,
        emoji: type.emoji,
        label: type.label,
        count: value.count,
        mine: value.mine,
      });
    }
    summaries.sort((a, b) => {
      const left = typeById.get(a.typeId)?.sortOrder ?? 0;
      const right = typeById.get(b.typeId)?.sortOrder ?? 0;
      return left - right;
    });
    map.set(postId, summaries);
  }
  return map;
}

export async function reactionLabelForNotification(
  db: AppBatchDb,
  postId: string,
  actorUserId: string,
): Promise<string | null> {
  const [row] = await db
    .select({
      label: reactionTypes.label,
    })
    .from(socialReactions)
    .innerJoin(reactionTypes, eq(reactionTypes.id, socialReactions.reactionTypeId))
    .where(and(eq(socialReactions.postId, postId), eq(socialReactions.userId, actorUserId)));
  return row?.label ?? null;
}
