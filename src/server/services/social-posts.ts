import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import {
  bottleRegistrationBatches,
  bottles,
  drinkLogs,
  openingEvents,
  photos,
  socialOperationKeys,
  socialPostItems,
  socialPostRecipients,
  socialPosts,
  tastingNotes,
} from "@/db/schema.ts";
import { hashRequestBody } from "./cellar-crypto.ts";
import { requireAccessibleBottle } from "./cellar-access.ts";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  SOCIAL_MESSAGES,
  type SocialPost,
  type SocialPostItem,
  type SocialShareSource,
  type SocialSourceLookup,
} from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import type { PhotoBucket } from "./photos.ts";
import { photoContentEtag, readOwnedPhotoContent } from "./photos.ts";
import {
  fallbackProfile,
  getSocialProfile,
  isBlockedEitherWay,
  listActiveFriendEpochs,
  listActiveFriendIds,
  loadProfiles,
  requireCompletedProfile,
  requireViewablePost,
  toPublicProfile,
  viewerIdOfEpoch,
} from "./social-access.ts";
import { deleteNotificationsForTarget } from "./social-notifications.ts";
import { reactionSummariesForPosts } from "./social-reactions.ts";
import { socialShareRateLimiter } from "./social-rate-limit.ts";

function toIso(value: Date): string {
  return value.toISOString();
}

export async function createSocialShare(input: {
  db: AppBatchDb;
  userId: string;
  source: SocialShareSource;
  operationKey: string;
  now?: Date;
}): Promise<{ post: SocialPost | null; created: boolean }> {
  const now = input.now ?? new Date();
  await requireCompletedProfile(input.db, input.userId);
  if (!socialShareRateLimiter.consume(input.userId, now.getTime())) {
    throw new ApiError("rate_limited");
  }
  const requestHash = await hashRequestBody(input.source);
  const cached = await readSocialOperation< { postId: string } >(input.db, input.userId, input.operationKey, requestHash);
  if (cached) {
    if (cached.cancelled) {
      throw new ApiError("conflict", {
        fields: { "": ["この操作の共有は取り消されています"] },
        conflict: { reason: "cancelled" },
      });
    }
    if (cached.result?.postId) {
      return { post: await getSocialPost(input.db, input.userId, cached.result.postId), created: false };
    }
  }

  const prepared = await prepareShare(input.db, input.userId, input.source);
  const existing = await findExistingPost(input.db, prepared);
  if (existing) {
    await writeSocialOperation(input.db, {
      actorUserId: input.userId,
      operationKey: input.operationKey,
      requestHash,
      result: { postId: existing.id },
      now,
    });
    return { post: await getSocialPost(input.db, input.userId, existing.id), created: false };
  }

  const epochs = await listActiveFriendEpochs(input.db, input.userId);
  const recipients = [];
  for (const epoch of epochs) {
    const viewerId = viewerIdOfEpoch(epoch, input.userId);
    if (await isBlockedEitherWay(input.db, input.userId, viewerId)) {
      continue;
    }
    recipients.push({ viewerId, epochId: epoch.id });
  }
  if (recipients.length === 0) {
    throw new ApiError("conflict", {
      fields: { "": [SOCIAL_MESSAGES.noFriends] },
      conflict: { reason: "capacity" },
    });
  }

  const postId = crypto.randomUUID();
  await input.db.batch([
    input.db.insert(socialPosts).values({
      id: postId,
      authorUserId: input.userId,
      kind: prepared.kind,
      publishedAt: now,
      contentUpdatedAt: now,
      drinkLogId: prepared.drinkLogId,
      openingEventId: prepared.openingEventId,
      registrationBatchId: prepared.registrationBatchId,
      createdAt: now,
    }),
    ...prepared.items.map((item, index) =>
      input.db.insert(socialPostItems).values({
        id: crypto.randomUUID(),
        postId,
        sortOrder: index,
        sourceKind: item.sourceKind,
        sourceId: item.sourceId,
      }),
    ),
    ...recipients.map((recipient) =>
      input.db.insert(socialPostRecipients).values({
        postId,
        viewerUserId: recipient.viewerId,
        friendshipEpochId: recipient.epochId,
      }),
    ),
    socialOperationInsert(input.db, {
      actorUserId: input.userId,
      operationKey: input.operationKey,
      requestHash,
      result: { postId },
      now,
    }),
  ]);
  return { post: await getSocialPost(input.db, input.userId, postId), created: true };
}

export async function getSocialPost(
  db: AppBatchDb,
  viewerId: string,
  postId: string,
): Promise<SocialPost> {
  const post = await requireViewablePost(db, viewerId, postId);
  const [projected] = await projectPosts(db, viewerId, [post]);
  if (!projected) {
    throw new ApiError("not_found");
  }
  return projected;
}

export async function getSocialFeed(
  db: AppBatchDb,
  viewerId: string,
  input: { cursor?: string; limit: number },
): Promise<{ items: SocialPost[]; nextCursor: string | null; friendCount: number }> {
  const friendCount = (await listActiveFriendIds(db, viewerId)).length;
  const decoded = input.cursor ? decodeFeedCursor(input.cursor) : null;
  if (input.cursor && !decoded) {
    throw new ApiError("validation_error", { fields: { cursor: ["ページ情報が正しくありません"] } });
  }
  const rows = await db
    .select({ post: socialPosts })
    .from(socialPostRecipients)
    .innerJoin(socialPosts, eq(socialPosts.id, socialPostRecipients.postId))
    .innerJoin(
      (await import("@/db/schema.ts")).friendshipEpochs,
      eq((await import("@/db/schema.ts")).friendshipEpochs.id, socialPostRecipients.friendshipEpochId),
    )
    .where(
      and(
        eq(socialPostRecipients.viewerUserId, viewerId),
        isNull((await import("@/db/schema.ts")).friendshipEpochs.endedAt),
        decoded
          ? or(
              lt(socialPosts.publishedAt, new Date(decoded.publishedAtMs)),
              and(
                eq(socialPosts.publishedAt, new Date(decoded.publishedAtMs)),
                lt(socialPosts.id, decoded.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(socialPosts.publishedAt), desc(socialPosts.id))
    .limit(input.limit + 1);

  const own = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.authorUserId, viewerId),
        decoded
          ? or(
              lt(socialPosts.publishedAt, new Date(decoded.publishedAtMs)),
              and(
                eq(socialPosts.publishedAt, new Date(decoded.publishedAtMs)),
                lt(socialPosts.id, decoded.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(socialPosts.publishedAt), desc(socialPosts.id))
    .limit(input.limit + 1);

  const merged = new Map<string, typeof socialPosts.$inferSelect>();
  for (const row of rows) {
    merged.set(row.post.id, row.post);
  }
  for (const post of own) {
    merged.set(post.id, post);
  }
  const sorted = [...merged.values()].sort((a, b) => {
    const byTime = b.publishedAt.getTime() - a.publishedAt.getTime();
    return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
  });
  const page = sorted.slice(0, input.limit);
  const items = await projectPosts(db, viewerId, page);
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      sorted.length > input.limit && last
        ? encodeFeedCursor(last.publishedAt.getTime(), last.id)
        : null,
    friendCount,
  };
}

export async function lookupShareSources(
  db: AppBatchDb,
  userId: string,
  query: { bottleId?: string; drinkLogId?: string; registrationBatchId?: string },
): Promise<SocialSourceLookup> {
  const result: SocialSourceLookup = {
    openingEventId: null,
    drinkLogPostId: null,
    cellarAddPostId: null,
    openingPostId: null,
    batchPostId: null,
  };
  if (query.drinkLogId) {
    const log = await ownedDrinkLog(db, userId, query.drinkLogId);
    const [post] = await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.drinkLogId, log.id));
    result.drinkLogPostId = post?.id ?? null;
  }
  if (query.registrationBatchId) {
    const [batch] = await db
      .select({ id: bottleRegistrationBatches.id })
      .from(bottleRegistrationBatches)
      .where(
        and(
          eq(bottleRegistrationBatches.id, query.registrationBatchId),
          eq(bottleRegistrationBatches.userId, userId),
        ),
      );
    if (batch) {
      const [post] = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(eq(socialPosts.registrationBatchId, batch.id));
      result.batchPostId = post?.id ?? null;
    }
  }
  if (query.bottleId) {
    const bottle = await requireAccessibleBottle(db, userId, query.bottleId);
    const [event] = await db
      .select({ id: openingEvents.id })
      .from(openingEvents)
      .where(
        and(
          eq(openingEvents.bottleId, bottle.id),
          eq(openingEvents.userId, userId),
          isNull(openingEvents.cancelledAt),
        ),
      );
    result.openingEventId = event?.id ?? null;
    if (event) {
      const [openingPost] = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(eq(socialPosts.openingEventId, event.id));
      result.openingPostId = openingPost?.id ?? null;
    }
    const items = await db
      .select({ postId: socialPostItems.postId, kind: socialPosts.kind })
      .from(socialPostItems)
      .innerJoin(socialPosts, eq(socialPosts.id, socialPostItems.postId))
      .where(
        and(
          eq(socialPostItems.sourceKind, "bottle"),
          eq(socialPostItems.sourceId, bottle.id),
          eq(socialPosts.authorUserId, userId),
        ),
      );
    result.cellarAddPostId = items.find((item) => item.kind === "cellar_add")?.postId ?? null;
  }
  return result;
}

export async function getAuthorVisiblePosts(
  db: AppBatchDb,
  viewerId: string,
  authorId: string,
  input: { cursor?: string; limit: number },
): Promise<{ items: SocialPost[]; nextCursor: string | null }> {
  if (viewerId !== authorId) {
    const friends = await listActiveFriendIds(db, viewerId);
    if (!friends.includes(authorId)) {
      throw new ApiError("not_found");
    }
  }
  const feed = await getSocialFeed(db, viewerId, input);
  const items = feed.items.filter((item) => item.author.userId === authorId);
  return { items, nextCursor: feed.nextCursor };
}

export async function unsharePost(input: {
  db: AppBatchDb;
  userId: string;
  postId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  const [post] = await input.db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.id, input.postId), eq(socialPosts.authorUserId, input.userId)));
  if (!post) {
    throw new ApiError("not_found");
  }
  if (post.registrationBatchId) {
    await input.db
      .update(bottleRegistrationBatches)
      .set({ shareCancelledAt: now })
      .where(eq(bottleRegistrationBatches.id, post.registrationBatchId));
  }
  await deleteNotificationsForTarget(input.db, "social_post", post.id);
  await input.db.delete(socialPosts).where(eq(socialPosts.id, post.id));
  await input.db
    .update(socialOperationKeys)
    .set({ cancelledAt: now })
    .where(
      and(
        eq(socialOperationKeys.actorUserId, input.userId),
        sql`${socialOperationKeys.resultJson} LIKE ${`%"${post.id}"%`}`,
      ),
    );
  return { ok: true };
}

export async function readSocialPostPhoto(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  viewerId: string;
  postId: string;
  photoId: string;
  variant?: "thumb";
}) {
  const post = await getSocialPost(input.db, input.viewerId, input.postId);
  const allowed = new Set(post.items.flatMap((item) => item.photoIds));
  if (!allowed.has(input.photoId)) {
    throw new ApiError("not_found");
  }
  const [row] = await input.db.select().from(photos).where(eq(photos.id, input.photoId));
  if (!row) {
    throw new ApiError("not_found");
  }
  const content = await readOwnedPhotoContent(input.db, input.bucket, row, input.variant);
  return {
    ...content,
    etag: photoContentEtag(row.id, input.variant),
  };
}

export async function ensureOpeningEvent(input: {
  db: AppBatchDb;
  userId: string;
  bottleId: string;
  cellarId: string;
  openedAt: Date;
  openedOn: string;
}): Promise<string> {
  const [existing] = await input.db
    .select({ id: openingEvents.id })
    .from(openingEvents)
    .where(and(eq(openingEvents.bottleId, input.bottleId), isNull(openingEvents.cancelledAt)));
  if (existing) {
    return existing.id;
  }
  const id = crypto.randomUUID();
  await input.db.insert(openingEvents).values({
    id,
    userId: input.userId,
    bottleId: input.bottleId,
    cellarId: input.cellarId,
    openedAt: input.openedAt,
    openedOn: input.openedOn,
    cancelledAt: null,
    createdAt: input.openedAt,
  });
  return id;
}

export async function cancelOpeningEvent(db: AppBatchDb, bottleId: string, now = new Date()) {
  const [event] = await db
    .select()
    .from(openingEvents)
    .where(and(eq(openingEvents.bottleId, bottleId), isNull(openingEvents.cancelledAt)));
  if (!event) {
    return;
  }
  await db
    .update(openingEvents)
    .set({ cancelledAt: now })
    .where(eq(openingEvents.id, event.id));
  await db.delete(socialPosts).where(eq(socialPosts.openingEventId, event.id));
}

export async function ensureRegistrationBatch(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  batchId?: string | null;
  now?: Date;
}): Promise<string | null> {
  if (!input.batchId) {
    return null;
  }
  const now = input.now ?? new Date();
  const [existing] = await input.db
    .select()
    .from(bottleRegistrationBatches)
    .where(
      and(
        eq(bottleRegistrationBatches.id, input.batchId),
        eq(bottleRegistrationBatches.userId, input.userId),
      ),
    );
  if (existing) {
    return existing.id;
  }
  await input.db.insert(bottleRegistrationBatches).values({
    id: input.batchId,
    userId: input.userId,
    cellarId: input.cellarId,
    shareCancelledAt: null,
    createdAt: now,
  });
  return input.batchId;
}

export async function touchPostsForDrinkLog(db: AppBatchDb, drinkLogId: string, now = new Date()) {
  await db
    .update(socialPosts)
    .set({ contentUpdatedAt: now })
    .where(eq(socialPosts.drinkLogId, drinkLogId));
}

export async function touchPostsForBottle(db: AppBatchDb, bottleId: string, now = new Date()) {
  const items = await db
    .select({ postId: socialPostItems.postId })
    .from(socialPostItems)
    .where(and(eq(socialPostItems.sourceKind, "bottle"), eq(socialPostItems.sourceId, bottleId)));
  const ids = [...new Set(items.map((item) => item.postId))];
  if (ids.length === 0) {
    return;
  }
  await db.update(socialPosts).set({ contentUpdatedAt: now }).where(inArray(socialPosts.id, ids));
}

export async function deletePostsForDrinkLog(db: AppBatchDb, drinkLogId: string) {
  const rows = await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.drinkLogId, drinkLogId));
  for (const row of rows) {
    await deleteNotificationsForTarget(db, "social_post", row.id);
  }
  await db.delete(socialPosts).where(eq(socialPosts.drinkLogId, drinkLogId));
}

export async function onBottleDeleted(db: AppBatchDb, bottleId: string) {
  const items = await db
    .select()
    .from(socialPostItems)
    .where(and(eq(socialPostItems.sourceKind, "bottle"), eq(socialPostItems.sourceId, bottleId)));
  const postIds = [...new Set(items.map((item) => item.postId))];
  for (const item of items) {
    await db.delete(socialPostItems).where(eq(socialPostItems.id, item.id));
  }
  for (const postId of postIds) {
    const remaining = await db
      .select({ id: socialPostItems.id })
      .from(socialPostItems)
      .where(eq(socialPostItems.postId, postId));
    if (remaining.length === 0) {
      await deleteNotificationsForTarget(db, "social_post", postId);
      await db.delete(socialPosts).where(eq(socialPosts.id, postId));
    } else {
      await db.update(socialPosts).set({ contentUpdatedAt: new Date() }).where(eq(socialPosts.id, postId));
    }
  }
  await cancelOpeningEvent(db, bottleId);
}

export async function invalidateCellarSourcedPosts(db: AppBatchDb, userId: string, cellarId: string) {
  const events = await db
    .select({ id: openingEvents.id })
    .from(openingEvents)
    .where(and(eq(openingEvents.userId, userId), eq(openingEvents.cellarId, cellarId)));
  const eventIds = events.map((event) => event.id);
  if (eventIds.length > 0) {
    const openingPosts = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(inArray(socialPosts.openingEventId, eventIds));
    for (const post of openingPosts) {
      await deleteNotificationsForTarget(db, "social_post", post.id);
    }
    await db.delete(socialPosts).where(inArray(socialPosts.openingEventId, eventIds));
  }
  const cellarBottles = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.cellarId, cellarId));
  const bottleIds = cellarBottles.map((bottle) => bottle.id);
  if (bottleIds.length === 0) {
    return;
  }
  const authored = await db
    .select({ id: socialPosts.id, authorUserId: socialPosts.authorUserId })
    .from(socialPosts)
    .innerJoin(socialPostItems, eq(socialPostItems.postId, socialPosts.id))
    .where(
      and(
        eq(socialPosts.authorUserId, userId),
        eq(socialPostItems.sourceKind, "bottle"),
        inArray(socialPostItems.sourceId, bottleIds),
      ),
    );
  for (const post of authored) {
    await deleteNotificationsForTarget(db, "social_post", post.id);
    await db.delete(socialPosts).where(eq(socialPosts.id, post.id));
  }
}

type PreparedShare = {
  kind: SocialPost["kind"];
  drinkLogId: string | null;
  openingEventId: string | null;
  registrationBatchId: string | null;
  items: { sourceKind: "drink_log" | "bottle" | "opening_event" | "tasting_note"; sourceId: string }[];
};

async function prepareShare(
  db: AppBatchDb,
  userId: string,
  source: SocialShareSource,
): Promise<PreparedShare> {
  if (source.kind === "drink_log") {
    const log = await ownedDrinkLog(db, userId, source.drinkLogId);
    return {
      kind: "drink_log",
      drinkLogId: log.id,
      openingEventId: null,
      registrationBatchId: null,
      items: [{ sourceKind: "drink_log", sourceId: log.id }],
    };
  }
  if (source.kind === "opening") {
    const event = await ownedOpening(db, userId, source.openingEventId);
    return {
      kind: "opening",
      drinkLogId: null,
      openingEventId: event.id,
      registrationBatchId: null,
      items: [
        { sourceKind: "opening_event", sourceId: event.id },
        { sourceKind: "bottle", sourceId: event.bottleId },
      ],
    };
  }
  if (source.kind === "opening_with_log") {
    const event = await ownedOpening(db, userId, source.openingEventId);
    const log = await ownedDrinkLog(db, userId, source.drinkLogId);
    return {
      kind: "opening_with_log",
      drinkLogId: log.id,
      openingEventId: event.id,
      registrationBatchId: null,
      items: [
        { sourceKind: "opening_event", sourceId: event.id },
        { sourceKind: "bottle", sourceId: event.bottleId },
        { sourceKind: "drink_log", sourceId: log.id },
      ],
    };
  }
  if (source.kind === "cellar_add") {
    const bottle = await requireAccessibleBottle(db, userId, source.bottleId);
    if (bottle.createdBy !== userId) {
      throw new ApiError("not_found");
    }
    return {
      kind: "cellar_add",
      drinkLogId: null,
      openingEventId: null,
      registrationBatchId: null,
      items: [{ sourceKind: "bottle", sourceId: bottle.id }],
    };
  }
  const [batch] = await db
    .select()
    .from(bottleRegistrationBatches)
    .where(
      and(
        eq(bottleRegistrationBatches.id, source.registrationBatchId),
        eq(bottleRegistrationBatches.userId, userId),
      ),
    );
  if (!batch) {
    throw new ApiError("not_found");
  }
  if (batch.shareCancelledAt) {
    throw new ApiError("conflict", {
      fields: { "": ["このまとめ登録の共有は取り消されています"] },
      conflict: { reason: "cancelled" },
    });
  }
  const batchBottles = await db
    .select({ id: bottles.id, createdBy: bottles.createdBy })
    .from(bottles)
    .where(eq(bottles.registrationBatchId, batch.id));
  const mine = batchBottles.filter((bottle) => bottle.createdBy === userId);
  if (mine.length === 0) {
    throw new ApiError("not_found");
  }
  return {
    kind: "cellar_batch",
    drinkLogId: null,
    openingEventId: null,
    registrationBatchId: batch.id,
    items: mine.map((bottle) => ({ sourceKind: "bottle" as const, sourceId: bottle.id })),
  };
}

async function findExistingPost(db: AppBatchDb, prepared: PreparedShare) {
  if (prepared.drinkLogId) {
    const [row] = await db.select().from(socialPosts).where(eq(socialPosts.drinkLogId, prepared.drinkLogId));
    return row ?? null;
  }
  if (prepared.openingEventId) {
    const [row] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.openingEventId, prepared.openingEventId));
    return row ?? null;
  }
  if (prepared.registrationBatchId) {
    const [row] = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.registrationBatchId, prepared.registrationBatchId));
    return row ?? null;
  }
  const first = prepared.items[0];
  if (!first || first.sourceKind !== "bottle") {
    return null;
  }
  const items = await db
    .select({ postId: socialPostItems.postId, kind: socialPosts.kind })
    .from(socialPostItems)
    .innerJoin(socialPosts, eq(socialPosts.id, socialPostItems.postId))
    .where(and(eq(socialPostItems.sourceKind, "bottle"), eq(socialPostItems.sourceId, first.sourceId)));
  const match = items.find((item) => item.kind === "cellar_add");
  if (!match) {
    return null;
  }
  const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, match.postId));
  return row ?? null;
}

async function ownedDrinkLog(db: AppBatchDb, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(drinkLogs)
    .where(and(eq(drinkLogs.id, id), eq(drinkLogs.userId, userId)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

async function ownedOpening(db: AppBatchDb, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(openingEvents)
    .where(and(eq(openingEvents.id, id), eq(openingEvents.userId, userId), isNull(openingEvents.cancelledAt)));
  if (!row) {
    throw new ApiError("not_found");
  }
  return row;
}

async function projectPosts(
  db: AppBatchDb,
  viewerId: string,
  posts: (typeof socialPosts.$inferSelect)[],
): Promise<SocialPost[]> {
  if (posts.length === 0) {
    return [];
  }
  const postIds = posts.map((post) => post.id);
  const items = await db.select().from(socialPostItems).where(inArray(socialPostItems.postId, postIds));
  const drinkLogIds = items.filter((item) => item.sourceKind === "drink_log").map((item) => item.sourceId);
  const bottleIds = items.filter((item) => item.sourceKind === "bottle").map((item) => item.sourceId);
  const openingIds = items.filter((item) => item.sourceKind === "opening_event").map((item) => item.sourceId);
  const [logRows, bottleRows, openingRows, noteRows, photoRows, reactions] = await Promise.all([
    drinkLogIds.length
      ? db.select().from(drinkLogs).where(inArray(drinkLogs.id, drinkLogIds))
      : Promise.resolve([]),
    bottleIds.length ? db.select().from(bottles).where(inArray(bottles.id, bottleIds)) : Promise.resolve([]),
    openingIds.length
      ? db.select().from(openingEvents).where(inArray(openingEvents.id, openingIds))
      : Promise.resolve([]),
    drinkLogIds.length
      ? db.select().from(tastingNotes).where(inArray(tastingNotes.drinkLogId, drinkLogIds))
      : Promise.resolve([]),
    [...drinkLogIds, ...bottleIds].length
      ? db
          .select()
          .from(photos)
          .where(
            or(
              drinkLogIds.length ? inArray(photos.drinkLogId, drinkLogIds) : undefined,
              bottleIds.length ? inArray(photos.bottleId, bottleIds) : undefined,
              drinkLogIds.length
                ? inArray(
                    photos.tastingNoteId,
                    (
                      await db
                        .select({ id: tastingNotes.id })
                        .from(tastingNotes)
                        .where(inArray(tastingNotes.drinkLogId, drinkLogIds))
                    ).map((note) => note.id),
                  )
                : undefined,
            ),
          )
      : Promise.resolve([]),
    reactionSummariesForPosts(db, viewerId, postIds),
  ]);
  const noteByLog = new Map(noteRows.map((note) => [note.drinkLogId, note]));
  const logById = new Map(logRows.map((log) => [log.id, log]));
  const bottleById = new Map(bottleRows.map((bottle) => [bottle.id, bottle]));
  const openingById = new Map(openingRows.map((event) => [event.id, event]));
  const photosByLog = new Map<string, string[]>();
  const photosByNote = new Map<string, string[]>();
  const photosByBottle = new Map<string, string[]>();
  for (const photo of photoRows) {
    if (photo.drinkLogId) {
      photosByLog.set(photo.drinkLogId, [...(photosByLog.get(photo.drinkLogId) ?? []), photo.id]);
    }
    if (photo.tastingNoteId) {
      photosByNote.set(photo.tastingNoteId, [...(photosByNote.get(photo.tastingNoteId) ?? []), photo.id]);
    }
    if (photo.bottleId) {
      photosByBottle.set(photo.bottleId, [...(photosByBottle.get(photo.bottleId) ?? []), photo.id]);
    }
  }
  const authors = await loadProfiles(db, posts.map((post) => post.authorUserId));
  const result: SocialPost[] = [];
  for (const post of posts) {
    const postItems = items
      .filter((item) => item.postId === post.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const projectedItems: SocialPostItem[] = [];
    const seenBottles = new Set<string>();
    for (const item of postItems) {
      if (item.sourceKind === "drink_log") {
        const log = logById.get(item.sourceId);
        if (!log) {
          continue;
        }
        const note = noteByLog.get(log.id);
        const tasting =
          note && (note.appearance || note.aroma || note.taste || note.finish)
            ? {
                appearance: note.appearance,
                aroma: note.aroma,
                taste: note.taste,
                finish: note.finish,
              }
            : null;
        projectedItems.push({
          name: log.drinkName ?? note?.drinkName ?? "お酒",
          producer: null,
          origin: null,
          variety: null,
          vintage: null,
          photoIds: [
            ...(photosByLog.get(log.id) ?? []),
            ...(note ? (photosByNote.get(note.id) ?? []) : []),
          ],
          drunkOn: log.drunkOn,
          openedOn: null,
          ratingX10: note?.ratingX10 ?? null,
          comment: note?.taste ?? null,
          tasting,
        });
      }
      if (item.sourceKind === "bottle") {
        if (seenBottles.has(item.sourceId)) {
          continue;
        }
        seenBottles.add(item.sourceId);
        const bottle = bottleById.get(item.sourceId);
        if (!bottle) {
          continue;
        }
        const opening = [...openingById.values()].find((event) => event.bottleId === bottle.id);
        projectedItems.push({
          name: bottle.name,
          producer: bottle.producer,
          origin: bottle.origin,
          variety: bottle.variety,
          vintage: bottle.vintage,
          photoIds: photosByBottle.get(bottle.id) ?? [],
          drunkOn: null,
          openedOn: opening?.openedOn ?? null,
          ratingX10: null,
          comment: null,
          tasting: null,
        });
      }
    }
    if (projectedItems.length === 0) {
      continue;
    }
    const author =
      authors.get(post.authorUserId) ??
      (await getSocialProfile(db, post.authorUserId).then((row) =>
        row ? toPublicProfile(row) : fallbackProfile(post.authorUserId),
      ));
    result.push({
      id: post.id,
      kind: post.kind,
      publishedAt: toIso(post.publishedAt),
      contentUpdatedAt: toIso(post.contentUpdatedAt),
      edited: post.contentUpdatedAt.getTime() > post.publishedAt.getTime() + 1000,
      author,
      items: projectedItems,
      reactions: reactions.get(post.id) ?? [],
      canReact: viewerId !== post.authorUserId,
      isAuthor: viewerId === post.authorUserId,
      sourceDrinkLogId: post.drinkLogId,
      sourceBottleId: projectedItems.length === 1 ? bottleIdsFromItems(postItems) : null,
    });
  }
  return result;
}

function bottleIdsFromItems(
  items: { sourceKind: string; sourceId: string }[],
): string | null {
  const bottle = items.find((item) => item.sourceKind === "bottle");
  return bottle?.sourceId ?? null;
}

async function readSocialOperation<T>(
  db: AppBatchDb,
  actorUserId: string,
  operationKey: string,
  requestHash: string,
): Promise<{ result: T | null; cancelled: boolean } | null> {
  const [row] = await db
    .select()
    .from(socialOperationKeys)
    .where(
      and(
        eq(socialOperationKeys.actorUserId, actorUserId),
        eq(socialOperationKeys.operationKey, operationKey),
      ),
    );
  if (!row) {
    return null;
  }
  if (row.requestHash !== requestHash) {
    throw new ApiError("conflict", {
      fields: { operationKey: ["同じ操作キーで異なる内容は実行できません"] },
      conflict: { reason: "idempotency" },
    });
  }
  return {
    cancelled: Boolean(row.cancelledAt),
    result: JSON.parse(row.resultJson) as T,
  };
}

async function writeSocialOperation(
  db: AppBatchDb,
  input: {
    actorUserId: string;
    operationKey: string;
    requestHash: string;
    result: unknown;
    now: Date;
  },
) {
  await db.insert(socialOperationKeys).values({
    actorUserId: input.actorUserId,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
    resultJson: JSON.stringify(input.result),
    cancelledAt: null,
    createdAt: input.now,
  }).onConflictDoNothing();
}

function socialOperationInsert(
  db: AppBatchDb,
  input: {
    actorUserId: string;
    operationKey: string;
    requestHash: string;
    result: unknown;
    now: Date;
  },
) {
  return db.insert(socialOperationKeys).values({
    actorUserId: input.actorUserId,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
    resultJson: JSON.stringify(input.result),
    cancelledAt: null,
    createdAt: input.now,
  });
}
