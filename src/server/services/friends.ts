import { and, eq, isNull, or } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { friendInvitations, friendRequests, friendshipEpochs, socialBlocks } from "@/db/schema.ts";
import type {
  FriendInvitation,
  FriendRequest,
  FriendsList,
  InvitePreview,
  SocialPublicProfile,
} from "@/shared/social.ts";
import { SOCIAL_INVITE_TTL_MS } from "@/shared/social.ts";
import { ApiError } from "../errors.ts";
import {
  fallbackProfile,
  getActiveEpoch,
  isBlockedEitherWay,
  listActiveFriendIds,
  loadProfiles,
  loadPublicProfile,
  pairIds,
} from "./social-access.ts";
import {
  friendInviteJoinUrl,
  friendInviteQrSvg,
  generateInviteToken,
  hashInviteToken,
} from "./social-crypto.ts";
import {
  acceptedDedupKey,
  deleteNotificationsBetweenUsers,
  deleteNotificationsByDedup,
  requestDedupKey,
  type SocialUnreadSink,
  upsertNotification,
} from "./social-notifications.ts";
import { socialInviteCreateRateLimiter, socialRequestRateLimiter } from "./social-rate-limit.ts";

export async function createOrGetInvitation(input: {
  db: AppBatchDb;
  userId: string;
  origin: string;
  now?: Date;
}): Promise<FriendInvitation> {
  const now = input.now ?? new Date();
  if (!socialInviteCreateRateLimiter.consume(input.userId, now.getTime())) {
    throw new ApiError("rate_limited");
  }
  const [existing] = await input.db
    .select()
    .from(friendInvitations)
    .where(
      and(eq(friendInvitations.ownerUserId, input.userId), isNull(friendInvitations.revokedAt)),
    );
  if (existing && existing.expiresAt.getTime() > now.getTime()) {
    throw new ApiError("conflict", {
      fields: { "": ["有効な招待があります。再発行するか、表示中のリンクを使ってください"] },
      conflict: { reason: "already_shared" },
    });
  }
  return issueInvitation(input.db, input.userId, input.origin, now);
}

export async function currentInvitationForOwner(input: {
  db: AppBatchDb;
  userId: string;
  origin: string;
  token?: string;
  now?: Date;
}): Promise<FriendInvitation> {
  const now = input.now ?? new Date();
  if (input.token) {
    const tokenHash = await hashInviteToken(input.token);
    const [row] = await input.db
      .select()
      .from(friendInvitations)
      .where(
        and(
          eq(friendInvitations.ownerUserId, input.userId),
          eq(friendInvitations.tokenHash, tokenHash),
          isNull(friendInvitations.revokedAt),
        ),
      );
    if (row && row.expiresAt.getTime() > now.getTime()) {
      const url = friendInviteJoinUrl(input.origin, input.token);
      return { url, expiresAt: row.expiresAt.toISOString(), qrSvg: friendInviteQrSvg(url) };
    }
  }
  const [existing] = await input.db
    .select()
    .from(friendInvitations)
    .where(
      and(eq(friendInvitations.ownerUserId, input.userId), isNull(friendInvitations.revokedAt)),
    );
  if (existing && existing.expiresAt.getTime() > now.getTime()) {
    if (!socialInviteCreateRateLimiter.consume(input.userId, now.getTime())) {
      throw new ApiError("rate_limited");
    }
    await input.db
      .update(friendInvitations)
      .set({ revokedAt: now })
      .where(
        and(eq(friendInvitations.ownerUserId, input.userId), isNull(friendInvitations.revokedAt)),
      );
  }
  return issueInvitation(input.db, input.userId, input.origin, now);
}

export async function reissueInvitation(input: {
  db: AppBatchDb;
  userId: string;
  origin: string;
  now?: Date;
}): Promise<FriendInvitation> {
  const now = input.now ?? new Date();
  if (!socialInviteCreateRateLimiter.consume(input.userId, now.getTime())) {
    throw new ApiError("rate_limited");
  }
  await input.db
    .update(friendInvitations)
    .set({ revokedAt: now })
    .where(
      and(eq(friendInvitations.ownerUserId, input.userId), isNull(friendInvitations.revokedAt)),
    );
  return issueInvitation(input.db, input.userId, input.origin, now);
}

async function issueInvitation(
  db: AppBatchDb,
  userId: string,
  origin: string,
  now: Date,
): Promise<FriendInvitation> {
  const token = generateInviteToken();
  const tokenHash = await hashInviteToken(token);
  await db.insert(friendInvitations).values({
    id: crypto.randomUUID(),
    ownerUserId: userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + SOCIAL_INVITE_TTL_MS),
    revokedAt: null,
    createdAt: now,
  });
  const url = friendInviteJoinUrl(origin, token);
  return {
    url,
    expiresAt: new Date(now.getTime() + SOCIAL_INVITE_TTL_MS).toISOString(),
    qrSvg: friendInviteQrSvg(url),
  };
}

export async function previewInvitation(
  db: AppBatchDb,
  viewerId: string,
  token: string,
  now = new Date(),
): Promise<InvitePreview> {
  const invitation = await lookupInvitation(db, token, now);
  if (!invitation) {
    return {
      status: "unavailable",
      profile: null,
      alreadyFriends: false,
      alreadyRequested: false,
      reversePending: false,
    };
  }
  if (invitation.ownerUserId === viewerId) {
    const profile = await loadPublicProfile(db, viewerId);
    return {
      status: "ok",
      profile: profile ?? fallbackProfile(viewerId),
      alreadyFriends: false,
      alreadyRequested: false,
      reversePending: false,
    };
  }
  if (await isBlockedEitherWay(db, viewerId, invitation.ownerUserId)) {
    return {
      status: "unavailable",
      profile: null,
      alreadyFriends: false,
      alreadyRequested: false,
      reversePending: false,
    };
  }
  const owner = await loadPublicProfile(db, invitation.ownerUserId);
  const epoch = await getActiveEpoch(db, viewerId, invitation.ownerUserId);
  const pending = await findPendingRequest(db, viewerId, invitation.ownerUserId);
  return {
    status: "ok",
    profile: owner ?? fallbackProfile(invitation.ownerUserId),
    alreadyFriends: Boolean(epoch),
    alreadyRequested: pending?.requesterUserId === viewerId,
    reversePending: pending?.requesterUserId === invitation.ownerUserId,
  };
}

export async function createFriendRequest(input: {
  db: AppBatchDb;
  requesterUserId: string;
  token: string;
  now?: Date;
  onUnread?: SocialUnreadSink;
}): Promise<{ request: FriendRequest }> {
  const now = input.now ?? new Date();
  if (!socialRequestRateLimiter.consume(input.requesterUserId, now.getTime())) {
    throw new ApiError("rate_limited");
  }
  const invitation = await lookupInvitation(input.db, input.token, now);
  if (!invitation || invitation.ownerUserId === input.requesterUserId) {
    throw new ApiError("not_found");
  }
  if (await isBlockedEitherWay(input.db, input.requesterUserId, invitation.ownerUserId)) {
    throw new ApiError("not_found");
  }
  const epoch = await getActiveEpoch(input.db, input.requesterUserId, invitation.ownerUserId);
  if (epoch) {
    throw new ApiError("conflict", {
      fields: { "": ["すでに友達です"] },
      conflict: { reason: "already_friends" },
    });
  }
  const pending = await findPendingRequest(input.db, input.requesterUserId, invitation.ownerUserId);
  if (pending?.requesterUserId === input.requesterUserId) {
    throw new ApiError("conflict", {
      fields: { "": ["すでに申請しています"] },
      conflict: { reason: "already_requested" },
    });
  }
  if (pending?.requesterUserId === invitation.ownerUserId) {
    throw new ApiError("conflict", {
      fields: { "": ["相手からの申請を確認してください"] },
      conflict: { reason: "reverse_request" },
    });
  }
  const id = crypto.randomUUID();
  await input.db.insert(friendRequests).values({
    id,
    requesterUserId: input.requesterUserId,
    recipientUserId: invitation.ownerUserId,
    invitationId: invitation.id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  });
  await upsertNotification({
    db: input.db,
    recipientUserId: invitation.ownerUserId,
    actorUserId: input.requesterUserId,
    type: "friend_request",
    dedupKey: requestDedupKey(id),
    targetKind: "friend_request",
    targetId: id,
    now,
    onUnread: input.onUnread,
  });
  const request = await loadRequest(input.db, id, input.requesterUserId);
  return { request };
}

export async function acceptFriendRequest(input: {
  db: AppBatchDb;
  userId: string;
  requestId: string;
  now?: Date;
  onUnread?: SocialUnreadSink;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  const request = await loadRawRequest(input.db, input.requestId);
  if (!request || request.recipientUserId !== input.userId) {
    throw new ApiError("not_found");
  }
  if (request.status === "accepted") {
    return { ok: true };
  }
  if (request.status !== "pending") {
    throw new ApiError("not_found");
  }
  if (await isBlockedEitherWay(input.db, request.requesterUserId, request.recipientUserId)) {
    throw new ApiError("not_found");
  }
  const { low, high } = pairIds(request.requesterUserId, request.recipientUserId);
  const existing = await getActiveEpoch(input.db, low, high);
  const epochId = existing?.id ?? crypto.randomUUID();
  await input.db.batch([
    input.db
      .update(friendRequests)
      .set({ status: "accepted", updatedAt: now, resolvedAt: now })
      .where(and(eq(friendRequests.id, request.id), eq(friendRequests.status, "pending"))),
    existing
      ? input.db
          .update(friendshipEpochs)
          .set({ acceptedAt: existing.acceptedAt })
          .where(eq(friendshipEpochs.id, existing.id))
      : input.db.insert(friendshipEpochs).values({
          id: epochId,
          userLowId: low,
          userHighId: high,
          acceptedAt: now,
          endedAt: null,
          endedReason: null,
        }),
  ]);
  await deleteNotificationsByDedup(input.db, request.recipientUserId, requestDedupKey(request.id));
  await upsertNotification({
    db: input.db,
    recipientUserId: request.requesterUserId,
    actorUserId: request.recipientUserId,
    type: "friend_accepted",
    dedupKey: acceptedDedupKey(epochId, request.recipientUserId),
    targetKind: "user",
    targetId: request.recipientUserId,
    now,
    onUnread: input.onUnread,
  });
  return { ok: true };
}

export async function declineFriendRequest(input: {
  db: AppBatchDb;
  userId: string;
  requestId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  const request = await loadRawRequest(input.db, input.requestId);
  if (!request || request.recipientUserId !== input.userId) {
    throw new ApiError("not_found");
  }
  if (request.status !== "pending") {
    return { ok: true };
  }
  await input.db
    .update(friendRequests)
    .set({ status: "declined", updatedAt: now, resolvedAt: now })
    .where(and(eq(friendRequests.id, request.id), eq(friendRequests.status, "pending")));
  await deleteNotificationsByDedup(input.db, request.recipientUserId, requestDedupKey(request.id));
  return { ok: true };
}

export async function cancelFriendRequest(input: {
  db: AppBatchDb;
  userId: string;
  requestId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  const request = await loadRawRequest(input.db, input.requestId);
  if (!request || request.requesterUserId !== input.userId) {
    throw new ApiError("not_found");
  }
  if (request.status !== "pending") {
    return { ok: true };
  }
  await input.db
    .update(friendRequests)
    .set({ status: "cancelled", updatedAt: now, resolvedAt: now })
    .where(and(eq(friendRequests.id, request.id), eq(friendRequests.status, "pending")));
  await deleteNotificationsByDedup(input.db, request.recipientUserId, requestDedupKey(request.id));
  return { ok: true };
}

export async function listFriends(db: AppBatchDb, userId: string): Promise<FriendsList> {
  const friendIds = await listActiveFriendIds(db, userId);
  const profiles = await loadProfiles(db, friendIds);
  const pending = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "pending"),
        or(eq(friendRequests.requesterUserId, userId), eq(friendRequests.recipientUserId, userId)),
      ),
    );
  const peerIds = pending.map((row) =>
    row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId,
  );
  const requestProfiles = await loadProfiles(db, peerIds);
  const toRequest = (row: (typeof pending)[number]): FriendRequest => {
    const peerId = row.requesterUserId === userId ? row.recipientUserId : row.requesterUserId;
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      peer: requestProfiles.get(peerId) ?? fallbackProfile(peerId),
      direction: row.requesterUserId === userId ? "outgoing" : "incoming",
    };
  };
  return {
    friends: friendIds.map((id) => profiles.get(id) ?? fallbackProfile(id)),
    incoming: pending.filter((row) => row.recipientUserId === userId).map(toRequest),
    outgoing: pending.filter((row) => row.requesterUserId === userId).map(toRequest),
  };
}

export async function unfriend(input: {
  db: AppBatchDb;
  userId: string;
  peerUserId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  if (input.userId === input.peerUserId) {
    throw new ApiError("not_found");
  }
  const epoch = await getActiveEpoch(input.db, input.userId, input.peerUserId);
  if (!epoch) {
    return { ok: true };
  }
  await endEpoch(input.db, epoch.id, "unfriended", now);
  await deleteNotificationsBetweenUsers(input.db, input.userId, input.peerUserId);
  return { ok: true };
}

export async function blockUser(input: {
  db: AppBatchDb;
  userId: string;
  peerUserId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  if (input.userId === input.peerUserId) {
    throw new ApiError("validation_error", { fields: { userId: ["自分はブロックできません"] } });
  }
  await input.db
    .insert(socialBlocks)
    .values({
      blockerUserId: input.userId,
      blockedUserId: input.peerUserId,
      createdAt: now,
    })
    .onConflictDoNothing();
  const epoch = await getActiveEpoch(input.db, input.userId, input.peerUserId);
  if (epoch) {
    await endEpoch(input.db, epoch.id, "blocked", now);
  }
  const pending = await findPendingRequest(input.db, input.userId, input.peerUserId);
  if (pending) {
    await input.db
      .update(friendRequests)
      .set({ status: "cancelled", updatedAt: now, resolvedAt: now })
      .where(eq(friendRequests.id, pending.id));
    await deleteNotificationsByDedup(
      input.db,
      pending.recipientUserId,
      requestDedupKey(pending.id),
    );
  }
  await deleteNotificationsBetweenUsers(input.db, input.userId, input.peerUserId);
  return { ok: true };
}

export async function unblockUser(input: {
  db: AppBatchDb;
  userId: string;
  peerUserId: string;
}): Promise<{ ok: true }> {
  await input.db
    .delete(socialBlocks)
    .where(
      and(
        eq(socialBlocks.blockerUserId, input.userId),
        eq(socialBlocks.blockedUserId, input.peerUserId),
      ),
    );
  return { ok: true };
}

export async function listBlocks(
  db: AppBatchDb,
  userId: string,
): Promise<{ items: SocialPublicProfile[] }> {
  const rows = await db
    .select({ blockedUserId: socialBlocks.blockedUserId })
    .from(socialBlocks)
    .where(eq(socialBlocks.blockerUserId, userId));
  const ids = rows.map((row) => row.blockedUserId);
  const profiles = await loadProfiles(db, ids);
  return { items: ids.map((id) => profiles.get(id) ?? fallbackProfile(id)) };
}

async function endEpoch(db: AppBatchDb, epochId: string, reason: string, now: Date) {
  await db
    .update(friendshipEpochs)
    .set({ endedAt: now, endedReason: reason })
    .where(and(eq(friendshipEpochs.id, epochId), isNull(friendshipEpochs.endedAt)));
}

async function lookupInvitation(db: AppBatchDb, token: string, now: Date) {
  const tokenHash = await hashInviteToken(token);
  const [row] = await db
    .select()
    .from(friendInvitations)
    .where(eq(friendInvitations.tokenHash, tokenHash));
  if (!row || row.revokedAt || row.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return row;
}

async function findPendingRequest(db: AppBatchDb, userA: string, userB: string) {
  const [row] = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "pending"),
        or(
          and(eq(friendRequests.requesterUserId, userA), eq(friendRequests.recipientUserId, userB)),
          and(eq(friendRequests.requesterUserId, userB), eq(friendRequests.recipientUserId, userA)),
        ),
      ),
    );
  return row ?? null;
}

async function loadRawRequest(db: AppBatchDb, id: string) {
  const [row] = await db.select().from(friendRequests).where(eq(friendRequests.id, id));
  return row ?? null;
}

async function loadRequest(db: AppBatchDb, id: string, viewerId: string): Promise<FriendRequest> {
  const row = await loadRawRequest(db, id);
  if (!row) {
    throw new ApiError("not_found");
  }
  const peerId = row.requesterUserId === viewerId ? row.recipientUserId : row.requesterUserId;
  const profile = await loadPublicProfile(db, peerId);
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    peer: profile ?? fallbackProfile(peerId),
    direction: row.requesterUserId === viewerId ? "outgoing" : "incoming",
  };
}
