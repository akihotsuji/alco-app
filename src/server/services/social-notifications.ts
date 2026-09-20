import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { friendRequests, socialNotifications } from "@/db/schema.ts";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  type SocialNotification,
  type SocialNotificationType,
} from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import { fallbackProfile, loadProfiles } from "./social-access.ts";
import { reactionLabelForNotification } from "./social-reactions.ts";

function toIso(value: Date): string {
  return value.toISOString();
}

export async function upsertNotification(input: {
  db: AppBatchDb;
  recipientUserId: string;
  actorUserId: string | null;
  type: SocialNotificationType;
  dedupKey: string;
  targetKind?: string | null;
  targetId?: string | null;
  now?: Date;
  refreshUnread?: boolean;
}) {
  const now = input.now ?? new Date();
  const [existing] = await input.db
    .select()
    .from(socialNotifications)
    .where(
      and(
        eq(socialNotifications.recipientUserId, input.recipientUserId),
        eq(socialNotifications.dedupKey, input.dedupKey),
      ),
    );
  if (existing) {
    const recentlyTouched =
      existing.updatedAt.getTime() > now.getTime() - 30_000 ||
      (existing.readAt !== null && now.getTime() - existing.updatedAt.getTime() < 60_000);
    await input.db
      .update(socialNotifications)
      .set({
        actorUserId: input.actorUserId,
        type: input.type,
        targetKind: input.targetKind ?? existing.targetKind,
        targetId: input.targetId ?? existing.targetId,
        readAt: input.refreshUnread === false || recentlyTouched ? existing.readAt : null,
        updatedAt: now,
      })
      .where(eq(socialNotifications.id, existing.id));
    return existing.id;
  }
  const id = crypto.randomUUID();
  await input.db.insert(socialNotifications).values({
    id,
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: input.type,
    targetKind: input.targetKind ?? null,
    targetId: input.targetId ?? null,
    dedupKey: input.dedupKey,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function deleteNotificationsByDedup(
  db: AppBatchDb,
  recipientUserId: string,
  dedupKey: string,
) {
  await db
    .delete(socialNotifications)
    .where(
      and(
        eq(socialNotifications.recipientUserId, recipientUserId),
        eq(socialNotifications.dedupKey, dedupKey),
      ),
    );
}

export async function deleteNotificationsForTarget(
  db: AppBatchDb,
  targetKind: string,
  targetId: string,
) {
  await db
    .delete(socialNotifications)
    .where(
      and(
        eq(socialNotifications.targetKind, targetKind),
        eq(socialNotifications.targetId, targetId),
      ),
    );
}

export async function listNotifications(
  db: AppBatchDb,
  userId: string,
  cursor?: string,
  limit = 30,
): Promise<{ items: SocialNotification[]; nextCursor: string | null }> {
  const decoded = cursor ? decodeFeedCursor(cursor) : null;
  if (cursor && !decoded) {
    throw new ApiError("validation_error", {
      fields: { cursor: ["ページ情報が正しくありません"] },
    });
  }
  const rows = await db
    .select()
    .from(socialNotifications)
    .where(
      and(
        eq(socialNotifications.recipientUserId, userId),
        decoded
          ? or(
              lt(socialNotifications.createdAt, new Date(decoded.publishedAtMs)),
              and(
                eq(socialNotifications.createdAt, new Date(decoded.publishedAtMs)),
                lt(socialNotifications.id, decoded.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(socialNotifications.createdAt), desc(socialNotifications.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const profiles = await loadProfiles(
    db,
    page.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)),
  );
  const items = await Promise.all(page.map((row) => toNotification(db, row, profiles)));
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last ? encodeFeedCursor(last.createdAt.getTime(), last.id) : null,
  };
}

export async function unreadNotificationCount(db: AppBatchDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(socialNotifications)
    .where(
      and(eq(socialNotifications.recipientUserId, userId), isNull(socialNotifications.readAt)),
    );
  return Number(row?.n ?? 0);
}

export async function markNotificationRead(
  db: AppBatchDb,
  userId: string,
  id: string,
  now = new Date(),
) {
  const updated = await db
    .update(socialNotifications)
    .set({ readAt: now, updatedAt: now })
    .where(and(eq(socialNotifications.id, id), eq(socialNotifications.recipientUserId, userId)))
    .returning({ id: socialNotifications.id });
  if (updated.length === 0) {
    throw new ApiError("not_found");
  }
}

export async function markAllNotificationsRead(db: AppBatchDb, userId: string, now = new Date()) {
  await db
    .update(socialNotifications)
    .set({ readAt: now, updatedAt: now })
    .where(
      and(eq(socialNotifications.recipientUserId, userId), isNull(socialNotifications.readAt)),
    );
}

async function toNotification(
  db: AppBatchDb,
  row: typeof socialNotifications.$inferSelect,
  profiles: Map<string, ReturnType<typeof fallbackProfile>>,
): Promise<SocialNotification> {
  const actor = row.actorUserId
    ? (profiles.get(row.actorUserId) ?? fallbackProfile(row.actorUserId))
    : null;
  const name = actor?.nickname ?? "だれか";
  if (row.type === "friend_request") {
    const pending = row.targetId
      ? await db
          .select({ status: friendRequests.status })
          .from(friendRequests)
          .where(eq(friendRequests.id, row.targetId))
      : [];
    const canRespond = pending[0]?.status === "pending";
    return {
      id: row.id,
      type: row.type,
      createdAt: toIso(row.createdAt),
      readAt: row.readAt ? toIso(row.readAt) : null,
      actor,
      body: `${name}さんから友達申請が届きました`,
      href: "/friends/list",
      requestId: canRespond ? row.targetId : null,
      canRespond,
    };
  }
  if (row.type === "friend_accepted") {
    return {
      id: row.id,
      type: row.type,
      createdAt: toIso(row.createdAt),
      readAt: row.readAt ? toIso(row.readAt) : null,
      actor,
      body: `${name}さんと友達になりました`,
      href: actor ? `/friends/profile/${actor.userId}` : "/friends/list",
      requestId: null,
      canRespond: false,
    };
  }
  const label =
    row.targetId && row.actorUserId
      ? await reactionLabelForNotification(db, row.targetId, row.actorUserId)
      : null;
  return {
    id: row.id,
    type: row.type,
    createdAt: toIso(row.createdAt),
    readAt: row.readAt ? toIso(row.readAt) : null,
    actor,
    body: label ? `${name}さんが『${label}』と反応しました` : `${name}さんが反応しました`,
    href: row.targetId ? `/friends/posts/${row.targetId}` : "/friends",
    requestId: null,
    canRespond: false,
  };
}

export async function deleteNotificationsBetweenUsers(
  db: AppBatchDb,
  userA: string,
  userB: string,
) {
  await db
    .delete(socialNotifications)
    .where(
      or(
        and(
          eq(socialNotifications.recipientUserId, userA),
          eq(socialNotifications.actorUserId, userB),
        ),
        and(
          eq(socialNotifications.recipientUserId, userB),
          eq(socialNotifications.actorUserId, userA),
        ),
      ),
    );
}

export function reactionDedupKey(postId: string, actorUserId: string): string {
  return `reaction:${postId}:${actorUserId}`;
}

export function requestDedupKey(requestId: string): string {
  return `friend_request:${requestId}`;
}

export function acceptedDedupKey(epochId: string, actorUserId: string): string {
  return `friend_accepted:${epochId}:${actorUserId}`;
}
