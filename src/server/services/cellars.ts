import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import type { AppBatchDb } from "@/db/index.ts";
import {
  accountDeletionPhotoTasks,
  bottles,
  cellarActivity,
  cellarInvitations,
  cellarMembers,
  cellarOwnerTransfers,
  cellars,
  photos,
  userCellarSlots,
  user as users,
} from "@/db/schema.ts";
import {
  type AcceptInvitationInput,
  type CellarActivityItem,
  type CellarDetail,
  type CellarInvitation,
  type CellarMember,
  type CellarSummary,
  type CellarTransfer,
  type CreateCellarInput,
  type CreatedInvitation,
  type CreateTransferInput,
  type DeleteCellarInput,
  defaultSharedCellarName,
  type InvitationPreview,
  type MoveBottlesInput,
  type UpdateCellarInput,
} from "@/shared/cellars.ts";
import {
  CELLAR_ACTIVITY_TTL_MS,
  CELLAR_DEFAULT_SHARED_NAME,
  CELLAR_INVITE_PENDING_MAX,
  CELLAR_INVITE_TTL_MS,
  CELLAR_MEMBER_LIMIT,
  CELLAR_MOVE_MAX,
  CELLAR_PERSONAL_NAME,
  CELLAR_TRANSFER_TTL_MS,
  LEFT_MEMBER_DISPLAY_NAME,
} from "@/shared/constants.ts";
import { ApiError } from "../errors.ts";
import {
  actorDisplayName,
  bumpCellarRevision,
  displayNamesById,
  ensurePersonalCellar,
  requireCellarMember,
  requireCellarOwner,
} from "./cellar-access.ts";
import { generateInviteToken, hashInviteToken, inviteJoinUrl } from "./cellar-crypto.ts";
import {
  cellarCreateRateLimiter,
  cellarInviteCreateRateLimiter,
  cellarInviteUseRateLimiter,
} from "./cellar-rate-limit.ts";
import { idempotencyInsert, readIdempotentResult, recoverIdempotentResult } from "./idempotency.ts";

function requireIso(value: Date | number): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).getTime()
      ? new Date(value).toISOString()
      : new Date(value).toISOString();
}

function toIso(value: Date | number | null): string | null {
  if (value === null) {
    return null;
  }
  return requireIso(value);
}

function rateOrThrow(ok: boolean): void {
  if (!ok) {
    throw new ApiError("rate_limited");
  }
}

async function memberCount(db: AppBatchDb, cellarId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(cellarMembers)
    .where(eq(cellarMembers.cellarId, cellarId));
  return Number(row?.n ?? 0);
}

async function sealedCount(db: AppBatchDb, cellarId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(bottles)
    .where(and(eq(bottles.cellarId, cellarId), eq(bottles.status, "sealed")));
  return Number(row?.n ?? 0);
}

function toSummary(
  row: typeof cellars.$inferSelect,
  userId: string,
  counts: { members: number; bottles: number },
): CellarSummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.kind === "personal" ? CELLAR_PERSONAL_NAME : row.name,
    role: row.ownerUserId === userId ? "owner" : "member",
    memberCount: counts.members,
    revision: row.revision,
    bottleCount: counts.bottles,
  };
}

export async function listCellars(
  db: AppBatchDb,
  userId: string,
): Promise<{ items: CellarSummary[] }> {
  await ensurePersonalCellar(db, userId);
  const rows = await db
    .select({ cellar: cellars })
    .from(cellarMembers)
    .innerJoin(cellars, eq(cellars.id, cellarMembers.cellarId))
    .where(eq(cellarMembers.userId, userId));
  const ids = rows.map((row) => row.cellar.id);
  const [memberRows, bottleRows] = await Promise.all([
    ids.length === 0
      ? []
      : db
          .select({ cellarId: cellarMembers.cellarId, n: count() })
          .from(cellarMembers)
          .where(inArray(cellarMembers.cellarId, ids))
          .groupBy(cellarMembers.cellarId),
    ids.length === 0
      ? []
      : db
          .select({ cellarId: bottles.cellarId, n: count() })
          .from(bottles)
          .where(and(inArray(bottles.cellarId, ids), eq(bottles.status, "sealed")))
          .groupBy(bottles.cellarId),
  ]);
  const members = new Map(memberRows.map((row) => [row.cellarId, Number(row.n)]));
  const bottleCounts = new Map(bottleRows.map((row) => [row.cellarId, Number(row.n)]));
  const items = rows
    .map((row) =>
      toSummary(row.cellar, userId, {
        members: members.get(row.cellar.id) ?? 1,
        bottles: bottleCounts.get(row.cellar.id) ?? 0,
      }),
    )
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "personal" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "ja");
    });
  return { items };
}

export async function createSharedCellar(input: {
  db: AppBatchDb;
  userId: string;
  body: CreateCellarInput;
  requestHash: string;
  now?: Date;
}): Promise<CellarDetail> {
  rateOrThrow(cellarCreateRateLimiter.consume(input.userId));
  const now = input.now ?? new Date();
  await ensurePersonalCellar(input.db, input.userId, now);
  const [slot] = await input.db
    .select()
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, input.userId));

  const cached = await readIdempotentResult<CellarDetail>(input.db, {
    actorUserId: input.userId,
    cellarId: slot?.personalCellarId ?? "none",
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }

  if (slot?.sharedCellarId) {
    throw new ApiError("conflict", {
      fields: { "": ["すでに共有セラーに参加しています"] },
      conflict: { reason: "already_shared" },
    });
  }

  const cellarId = crypto.randomUUID();
  const name = defaultSharedCellarName(input.body.name);
  const result: CellarDetail = {
    id: cellarId,
    kind: "shared",
    name,
    role: "owner",
    memberCount: 1,
    revision: 1,
    bottleCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    pendingTransfer: null,
  };

  try {
    await input.db.batch([
      input.db.insert(cellars).values({
        id: cellarId,
        kind: "shared",
        name,
        ownerUserId: input.userId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
      input.db.insert(cellarMembers).values({
        id: crypto.randomUUID(),
        cellarId,
        userId: input.userId,
        joinedAt: now,
      }),
      input.db
        .update(userCellarSlots)
        .set({ sharedCellarId: cellarId })
        .where(
          and(eq(userCellarSlots.userId, input.userId), isNull(userCellarSlots.sharedCellarId)),
        ),
      input.db.insert(cellarActivity).values({
        id: crypto.randomUUID(),
        cellarId,
        actorUserId: input.userId,
        action: "member_joined",
        bottleId: null,
        bottleName: null,
        createdAt: now,
      }),
      idempotencyInsert(input.db, {
        actorUserId: input.userId,
        cellarId: slot?.personalCellarId ?? cellarId,
        operationKey: input.body.operationKey,
        requestHash: input.requestHash,
        result,
        now,
      }),
    ]);
  } catch (error) {
    const recovered = await recoverIdempotentResult<CellarDetail>(input.db, {
      actorUserId: input.userId,
      cellarId: slot?.personalCellarId ?? cellarId,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
    });
    if (recovered) {
      return recovered;
    }
    const [again] = await input.db
      .select()
      .from(userCellarSlots)
      .where(eq(userCellarSlots.userId, input.userId));
    if (again?.sharedCellarId && again.sharedCellarId !== cellarId) {
      throw new ApiError("conflict", {
        fields: { "": ["すでに共有セラーに参加しています"] },
        conflict: { reason: "already_shared" },
      });
    }
    throw error;
  }

  const [confirmed] = await input.db
    .select()
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, input.userId));
  if (confirmed?.sharedCellarId !== cellarId) {
    throw new ApiError("conflict", {
      fields: { "": ["すでに共有セラーに参加しています"] },
      conflict: { reason: "already_shared" },
    });
  }
  return result;
}

export async function getCellar(
  db: AppBatchDb,
  userId: string,
  cellarId: string,
): Promise<CellarDetail> {
  const access = await requireCellarMember(db, userId, cellarId);
  const [members, bottlesSealed, pending] = await Promise.all([
    memberCount(db, cellarId),
    sealedCount(db, cellarId),
    loadPendingTransfer(db, cellarId),
  ]);
  return {
    ...toSummary(access, userId, { members, bottles: bottlesSealed }),
    createdAt: requireIso(access.createdAt),
    updatedAt: requireIso(access.updatedAt),
    pendingTransfer: pending,
  };
}

export async function getCellarRevision(db: AppBatchDb, userId: string, cellarId: string) {
  const access = await requireCellarMember(db, userId, cellarId);
  return { id: access.id, revision: access.revision };
}

export async function updateCellarName(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  body: UpdateCellarInput;
  requestHash: string;
  now?: Date;
}): Promise<CellarDetail> {
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  const cached = await readIdempotentResult<CellarDetail>(input.db, {
    actorUserId: input.userId,
    cellarId: input.cellarId,
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const now = input.now ?? new Date();
  await input.db.batch([
    input.db
      .update(cellars)
      .set({ name: input.body.name, updatedAt: now, revision: sql`${cellars.revision} + 1` })
      .where(and(eq(cellars.id, access.id), eq(cellars.ownerUserId, input.userId))),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: input.userId,
      action: "cellar_renamed",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
      result: { pending: true },
      now,
    }),
  ]);
  const detail = await getCellar(input.db, input.userId, access.id);
  return detail;
}

export function enqueueCellarPhotoTasks(
  db: AppBatchDb,
  cellarId: string,
  requestId: string,
  nowMs: number,
) {
  return db
    .insert(accountDeletionPhotoTasks)
    .select(sql`
      SELECT r2_key, ${requestId}, 'pending', 0, ${nowMs}, NULL, NULL, ${nowMs}
      FROM photos
      WHERE cellar_id = ${cellarId}
    `)
    .onConflictDoNothing();
}

export async function deleteSharedCellar(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  body: DeleteCellarInput;
  requestHash: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  if (input.body.confirmName !== access.name) {
    throw new ApiError("validation_error", {
      fields: { confirmName: ["セラー名が一致しません"] },
    });
  }
  const cached = await readIdempotentResult<{ ok: true }>(input.db, {
    actorUserId: input.userId,
    cellarId: access.id,
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const now = input.now ?? new Date();
  const requestId = crypto.randomUUID();
  await input.db.batch([
    enqueueCellarPhotoTasks(input.db, access.id, requestId, now.getTime()),
    input.db
      .update(userCellarSlots)
      .set({ sharedCellarId: null })
      .where(eq(userCellarSlots.sharedCellarId, access.id)),
    input.db
      .delete(cellars)
      .where(and(eq(cellars.id, access.id), eq(cellars.ownerUserId, input.userId))),
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
      result: { ok: true },
      now,
    }),
  ]);
  return { ok: true };
}

export async function listMembers(
  db: AppBatchDb,
  userId: string,
  cellarId: string,
): Promise<{ items: CellarMember[] }> {
  const access = await requireCellarMember(db, userId, cellarId);
  const rows = await db
    .select({
      userId: cellarMembers.userId,
      joinedAt: cellarMembers.joinedAt,
      name: users.name,
    })
    .from(cellarMembers)
    .leftJoin(users, eq(users.id, cellarMembers.userId))
    .where(eq(cellarMembers.cellarId, access.id));
  return {
    items: rows.map((row) => ({
      userId: row.userId,
      displayName: row.name || LEFT_MEMBER_DISPLAY_NAME,
      role: row.userId === access.ownerUserId ? "owner" : "member",
      joinedAt: requireIso(row.joinedAt),
    })),
  };
}

export async function leaveSharedCellar(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  operationKey: string;
  requestHash: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const access = await requireCellarMember(input.db, input.userId, input.cellarId);
  if (access.kind === "personal") {
    throw new ApiError("not_found");
  }
  if (access.ownerUserId === input.userId) {
    const others = (await memberCount(input.db, access.id)) - 1;
    if (others > 0) {
      throw new ApiError("conflict", {
        fields: { "": ["所有権を移すか、共有セラーを削除してから退出してください"] },
        conflict: { reason: "owner_required" },
      });
    }
  }
  const cached = await readIdempotentResult<{ ok: true }>(input.db, {
    actorUserId: input.userId,
    cellarId: access.id,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const now = input.now ?? new Date();
  if (access.ownerUserId === input.userId) {
    const requestId = crypto.randomUUID();
    await input.db.batch([
      enqueueCellarPhotoTasks(input.db, access.id, requestId, now.getTime()),
      input.db
        .update(userCellarSlots)
        .set({ sharedCellarId: null })
        .where(eq(userCellarSlots.userId, input.userId)),
      input.db.delete(cellars).where(eq(cellars.id, access.id)),
      idempotencyInsert(input.db, {
        actorUserId: input.userId,
        cellarId: access.id,
        operationKey: input.operationKey,
        requestHash: input.requestHash,
        result: { ok: true },
        now,
      }),
    ]);
    return { ok: true };
  }
  await anonymizeActor(input.db, access.id, input.userId);
  await input.db.batch([
    input.db
      .delete(cellarMembers)
      .where(and(eq(cellarMembers.cellarId, access.id), eq(cellarMembers.userId, input.userId))),
    input.db
      .update(userCellarSlots)
      .set({ sharedCellarId: null })
      .where(
        and(
          eq(userCellarSlots.userId, input.userId),
          eq(userCellarSlots.sharedCellarId, access.id),
        ),
      ),
    bumpCellarRevision(input.db, access.id, now),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: null,
      action: "member_left",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.operationKey,
      requestHash: input.requestHash,
      result: { ok: true },
      now,
    }),
  ]);
  return { ok: true };
}

export async function removeMember(input: {
  db: AppBatchDb;
  actorUserId: string;
  cellarId: string;
  targetUserId: string;
  operationKey: string;
  requestHash: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const access = await requireCellarOwner(input.db, input.actorUserId, input.cellarId);
  if (input.targetUserId === input.actorUserId) {
    throw new ApiError("validation_error", {
      fields: { userId: ["自分は除名できません"] },
    });
  }
  const cached = await readIdempotentResult<{ ok: true }>(input.db, {
    actorUserId: input.actorUserId,
    cellarId: access.id,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const [target] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(
      and(eq(cellarMembers.cellarId, access.id), eq(cellarMembers.userId, input.targetUserId)),
    );
  if (!target) {
    throw new ApiError("not_found");
  }
  const now = input.now ?? new Date();
  await anonymizeActor(input.db, access.id, input.targetUserId);
  await input.db.batch([
    input.db
      .delete(cellarMembers)
      .where(
        and(eq(cellarMembers.cellarId, access.id), eq(cellarMembers.userId, input.targetUserId)),
      ),
    input.db
      .update(userCellarSlots)
      .set({ sharedCellarId: null })
      .where(
        and(
          eq(userCellarSlots.userId, input.targetUserId),
          eq(userCellarSlots.sharedCellarId, access.id),
        ),
      ),
    bumpCellarRevision(input.db, access.id, now),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: input.actorUserId,
      action: "member_removed",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
    idempotencyInsert(input.db, {
      actorUserId: input.actorUserId,
      cellarId: access.id,
      operationKey: input.operationKey,
      requestHash: input.requestHash,
      result: { ok: true },
      now,
    }),
  ]);
  return { ok: true };
}

export async function anonymizeSharedMembership(
  db: AppBatchDb,
  cellarId: string,
  userId: string,
): Promise<void> {
  await anonymizeActor(db, cellarId, userId);
}

async function anonymizeActor(db: AppBatchDb, cellarId: string, userId: string): Promise<void> {
  await db.batch([
    db
      .update(bottles)
      .set({ createdBy: null })
      .where(and(eq(bottles.cellarId, cellarId), eq(bottles.createdBy, userId))),
    db
      .update(bottles)
      .set({ updatedBy: null })
      .where(and(eq(bottles.cellarId, cellarId), eq(bottles.updatedBy, userId))),
    db
      .update(photos)
      .set({ uploadedBy: null })
      .where(and(eq(photos.cellarId, cellarId), eq(photos.uploadedBy, userId))),
    db
      .update(cellarActivity)
      .set({ actorUserId: null })
      .where(and(eq(cellarActivity.cellarId, cellarId), eq(cellarActivity.actorUserId, userId))),
  ]);
}

export async function listInvitations(
  db: AppBatchDb,
  userId: string,
  cellarId: string,
): Promise<{ items: CellarInvitation[] }> {
  const access = await requireCellarOwner(db, userId, cellarId);
  const rows = await db
    .select()
    .from(cellarInvitations)
    .where(eq(cellarInvitations.cellarId, access.id))
    .orderBy(desc(cellarInvitations.createdAt));
  return {
    items: rows.map((row) => ({
      id: row.id,
      expiresAt: requireIso(row.expiresAt),
      revokedAt: toIso(row.revokedAt),
      usedAt: toIso(row.usedAt),
    })),
  };
}

export async function createInvitation(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  operationKey: string;
  requestHash: string;
  origin: string;
  now?: Date;
}): Promise<CreatedInvitation> {
  rateOrThrow(cellarInviteCreateRateLimiter.consume(input.userId));
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  const cached = await readIdempotentResult<CreatedInvitation>(input.db, {
    actorUserId: input.userId,
    cellarId: access.id,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const now = input.now ?? new Date();
  const [pending] = await input.db
    .select({ n: count() })
    .from(cellarInvitations)
    .where(
      and(
        eq(cellarInvitations.cellarId, access.id),
        isNull(cellarInvitations.usedAt),
        isNull(cellarInvitations.revokedAt),
        sql`${cellarInvitations.expiresAt} > ${now.getTime()}`,
      ),
    );
  if (Number(pending?.n ?? 0) >= CELLAR_INVITE_PENDING_MAX) {
    throw new ApiError("conflict", {
      fields: { "": ["未使用の招待リンクが上限に達しています"] },
      conflict: { reason: "capacity" },
    });
  }
  const token = generateInviteToken();
  const tokenHash = await hashInviteToken(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + CELLAR_INVITE_TTL_MS);
  const created: CreatedInvitation = {
    id,
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
    usedAt: null,
    url: inviteJoinUrl(input.origin, token),
  };
  await input.db.batch([
    input.db.insert(cellarInvitations).values({
      id,
      cellarId: access.id,
      tokenHash,
      createdBy: input.userId,
      expiresAt,
      usedBy: null,
      usedAt: null,
      revokedAt: null,
      createdAt: now,
    }),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: input.userId,
      action: "invite_created",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
    bumpCellarRevision(input.db, access.id, now),
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.operationKey,
      requestHash: input.requestHash,
      result: created,
      now,
    }),
  ]);
  return created;
}

export async function revokeInvitation(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  invitationId: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  const now = input.now ?? new Date();
  const [row] = await input.db
    .select({ id: cellarInvitations.id })
    .from(cellarInvitations)
    .where(
      and(eq(cellarInvitations.id, input.invitationId), eq(cellarInvitations.cellarId, access.id)),
    );
  if (!row) {
    throw new ApiError("not_found");
  }
  await input.db.batch([
    input.db
      .update(cellarInvitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(cellarInvitations.id, input.invitationId),
          eq(cellarInvitations.cellarId, access.id),
          isNull(cellarInvitations.usedAt),
        ),
      ),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: input.userId,
      action: "invite_revoked",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
    bumpCellarRevision(input.db, access.id, now),
  ]);
  return { ok: true };
}

export async function previewInvitation(input: {
  db: AppBatchDb;
  userId: string;
  token: string;
  now?: Date;
}): Promise<InvitationPreview> {
  rateOrThrow(cellarInviteUseRateLimiter.consume(input.userId));
  await ensurePersonalCellar(input.db, input.userId, input.now);
  const invitation = await findUsableInvitation(input.db, input.token, input.now ?? new Date());
  if (!invitation) {
    return {
      status: "unavailable",
      cellarId: null,
      cellarName: null,
      inviterName: null,
      memberCount: null,
    };
  }
  const [membership] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(
      and(eq(cellarMembers.cellarId, invitation.cellarId), eq(cellarMembers.userId, input.userId)),
    );
  if (membership) {
    return {
      status: "already_member",
      cellarId: invitation.cellarId,
      cellarName: invitation.cellarName,
      inviterName: invitation.inviterName,
      memberCount: invitation.memberCount,
    };
  }
  const [slot] = await input.db
    .select()
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, input.userId));
  if (slot?.sharedCellarId) {
    return {
      status: "already_in_other",
      cellarId: slot.sharedCellarId,
      cellarName: invitation.cellarName,
      inviterName: invitation.inviterName,
      memberCount: invitation.memberCount,
    };
  }
  if (invitation.memberCount >= CELLAR_MEMBER_LIMIT) {
    return {
      status: "unavailable",
      cellarId: null,
      cellarName: null,
      inviterName: null,
      memberCount: null,
    };
  }
  return {
    status: "joinable",
    cellarId: invitation.cellarId,
    cellarName: invitation.cellarName,
    inviterName: invitation.inviterName,
    memberCount: invitation.memberCount,
  };
}

type LoadedInvitation = {
  id: string;
  cellarId: string;
  cellarName: string;
  inviterName: string;
  memberCount: number;
};

async function findUsableInvitation(
  db: AppBatchDb,
  token: string,
  now: Date,
): Promise<LoadedInvitation | null> {
  const tokenHash = await hashInviteToken(token);
  const [row] = await db
    .select({
      id: cellarInvitations.id,
      cellarId: cellarInvitations.cellarId,
      cellarName: cellars.name,
      createdBy: cellarInvitations.createdBy,
      expiresAt: cellarInvitations.expiresAt,
      usedAt: cellarInvitations.usedAt,
      revokedAt: cellarInvitations.revokedAt,
    })
    .from(cellarInvitations)
    .innerJoin(cellars, eq(cellars.id, cellarInvitations.cellarId))
    .where(eq(cellarInvitations.tokenHash, tokenHash));
  if (!row || row.usedAt || row.revokedAt || row.expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  const names = await displayNamesById(db, [row.createdBy]);
  return {
    id: row.id,
    cellarId: row.cellarId,
    cellarName: row.cellarName,
    inviterName: actorDisplayName(row.createdBy, names),
    memberCount: await memberCount(db, row.cellarId),
  };
}

export async function acceptInvitation(input: {
  db: AppBatchDb;
  userId: string;
  body: AcceptInvitationInput;
  requestHash: string;
  now?: Date;
}): Promise<{ cellarId: string }> {
  rateOrThrow(cellarInviteUseRateLimiter.consume(input.userId));
  const now = input.now ?? new Date();
  await ensurePersonalCellar(input.db, input.userId, now);
  const invitation = await findUsableInvitation(input.db, input.body.token, now);
  if (!invitation) {
    throw new ApiError("not_found");
  }
  const cached = await readIdempotentResult<{ cellarId: string }>(input.db, {
    actorUserId: input.userId,
    cellarId: invitation.cellarId,
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const [membership] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(
      and(eq(cellarMembers.cellarId, invitation.cellarId), eq(cellarMembers.userId, input.userId)),
    );
  if (membership) {
    return { cellarId: invitation.cellarId };
  }
  const [slot] = await input.db
    .select()
    .from(userCellarSlots)
    .where(eq(userCellarSlots.userId, input.userId));
  if (slot?.sharedCellarId) {
    throw new ApiError("conflict", {
      fields: { "": ["すでに別の共有セラーに参加しています"] },
      conflict: { reason: "already_shared" },
    });
  }
  if (invitation.memberCount >= CELLAR_MEMBER_LIMIT) {
    throw new ApiError("not_found");
  }

  const result = { cellarId: invitation.cellarId };
  const claimedInvite = sql`EXISTS (
    SELECT 1 FROM cellar_invitations
    WHERE id = ${invitation.id} AND used_by = ${input.userId}
  )`;
  try {
    await input.db.batch([
      input.db
        .update(cellarInvitations)
        .set({ usedBy: input.userId, usedAt: now })
        .where(
          and(
            eq(cellarInvitations.id, invitation.id),
            isNull(cellarInvitations.usedAt),
            isNull(cellarInvitations.revokedAt),
            sql`${cellarInvitations.expiresAt} > ${now.getTime()}`,
            sql`EXISTS (SELECT 1 FROM user_cellar_slots WHERE user_id = ${input.userId} AND shared_cellar_id IS NULL)`,
            sql`(SELECT COUNT(*) FROM cellar_members WHERE cellar_id = ${invitation.cellarId}) < ${CELLAR_MEMBER_LIMIT}`,
          ),
        ),
      input.db
        .update(userCellarSlots)
        .set({ sharedCellarId: invitation.cellarId })
        .where(
          and(
            eq(userCellarSlots.userId, input.userId),
            isNull(userCellarSlots.sharedCellarId),
            claimedInvite,
          ),
        ),
      input.db.insert(cellarMembers).select(sql`
        SELECT ${crypto.randomUUID()}, ${invitation.cellarId}, ${input.userId}, ${now.getTime()}
        WHERE ${claimedInvite}
        AND NOT EXISTS (
          SELECT 1 FROM cellar_members
          WHERE cellar_id = ${invitation.cellarId} AND user_id = ${input.userId}
        )
        AND (SELECT COUNT(*) FROM cellar_members WHERE cellar_id = ${invitation.cellarId}) < ${CELLAR_MEMBER_LIMIT}
      `),
      bumpCellarRevision(input.db, invitation.cellarId, now),
      input.db.insert(cellarActivity).values({
        id: crypto.randomUUID(),
        cellarId: invitation.cellarId,
        actorUserId: input.userId,
        action: "member_joined",
        bottleId: null,
        bottleName: null,
        createdAt: now,
      }),
      idempotencyInsert(input.db, {
        actorUserId: input.userId,
        cellarId: invitation.cellarId,
        operationKey: input.body.operationKey,
        requestHash: input.requestHash,
        result,
        now,
      }),
    ]);
  } catch (error) {
    const recovered = await recoverIdempotentResult<{ cellarId: string }>(input.db, {
      actorUserId: input.userId,
      cellarId: invitation.cellarId,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
    });
    if (recovered) {
      return recovered;
    }
    throw error;
  }

  const [joined] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(
      and(eq(cellarMembers.cellarId, invitation.cellarId), eq(cellarMembers.userId, input.userId)),
    );
  if (!joined) {
    const [slot] = await input.db
      .select()
      .from(userCellarSlots)
      .where(eq(userCellarSlots.userId, input.userId));
    if (slot?.sharedCellarId && slot.sharedCellarId !== invitation.cellarId) {
      throw new ApiError("conflict", {
        fields: { "": ["すでに別の共有セラーに参加しています"] },
        conflict: { reason: "already_shared" },
      });
    }
    throw new ApiError("not_found");
  }
  return result;
}

async function loadPendingTransfer(
  db: AppBatchDb,
  cellarId: string,
): Promise<CellarTransfer | null> {
  const [row] = await db
    .select()
    .from(cellarOwnerTransfers)
    .where(
      and(eq(cellarOwnerTransfers.cellarId, cellarId), eq(cellarOwnerTransfers.status, "pending")),
    );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    status: row.status,
    expiresAt: requireIso(row.expiresAt),
    createdAt: requireIso(row.createdAt),
  };
}

export async function createOwnerTransfer(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  body: CreateTransferInput;
  requestHash: string;
  now?: Date;
}): Promise<CellarTransfer> {
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  if (input.body.toUserId === input.userId) {
    throw new ApiError("validation_error", {
      fields: { toUserId: ["自分には移譲できません"] },
    });
  }
  const [target] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(
      and(eq(cellarMembers.cellarId, access.id), eq(cellarMembers.userId, input.body.toUserId)),
    );
  if (!target) {
    throw new ApiError("not_found");
  }
  const cached = await readIdempotentResult<CellarTransfer>(input.db, {
    actorUserId: input.userId,
    cellarId: access.id,
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const now = input.now ?? new Date();
  const transfer: CellarTransfer = {
    id: crypto.randomUUID(),
    fromUserId: input.userId,
    toUserId: input.body.toUserId,
    status: "pending",
    expiresAt: new Date(now.getTime() + CELLAR_TRANSFER_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  };
  await input.db.batch([
    input.db
      .update(cellarOwnerTransfers)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(cellarOwnerTransfers.cellarId, access.id),
          eq(cellarOwnerTransfers.status, "pending"),
        ),
      ),
    input.db.insert(cellarOwnerTransfers).values({
      id: transfer.id,
      cellarId: access.id,
      fromUserId: input.userId,
      toUserId: input.body.toUserId,
      status: "pending",
      expiresAt: new Date(transfer.expiresAt),
      acceptedAt: null,
      createdAt: now,
    }),
    bumpCellarRevision(input.db, access.id, now),
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
      result: transfer,
      now,
    }),
  ]);
  return transfer;
}

export async function cancelOwnerTransfer(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  transferId: string;
  operationKey: string;
  requestHash: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const access = await requireCellarOwner(input.db, input.userId, input.cellarId);
  const now = input.now ?? new Date();
  const [row] = await input.db
    .select()
    .from(cellarOwnerTransfers)
    .where(
      and(
        eq(cellarOwnerTransfers.id, input.transferId),
        eq(cellarOwnerTransfers.cellarId, access.id),
        eq(cellarOwnerTransfers.status, "pending"),
      ),
    );
  if (!row) {
    throw new ApiError("not_found");
  }
  await input.db
    .update(cellarOwnerTransfers)
    .set({ status: "cancelled" })
    .where(eq(cellarOwnerTransfers.id, row.id));
  await bumpCellarRevision(input.db, access.id, now);
  return { ok: true };
}

export async function acceptOwnerTransfer(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  transferId: string;
  operationKey: string;
  requestHash: string;
  now?: Date;
}): Promise<CellarDetail> {
  const access = await requireCellarMember(input.db, input.userId, input.cellarId);
  const now = input.now ?? new Date();
  const [row] = await input.db
    .select()
    .from(cellarOwnerTransfers)
    .where(
      and(
        eq(cellarOwnerTransfers.id, input.transferId),
        eq(cellarOwnerTransfers.cellarId, access.id),
        eq(cellarOwnerTransfers.toUserId, input.userId),
        eq(cellarOwnerTransfers.status, "pending"),
      ),
    );
  if (!row || row.expiresAt.getTime() <= now.getTime()) {
    throw new ApiError("not_found");
  }
  const [stillOwner] = await input.db
    .select({ ownerUserId: cellars.ownerUserId })
    .from(cellars)
    .where(and(eq(cellars.id, access.id), eq(cellars.ownerUserId, row.fromUserId ?? "")));
  const [stillMember] = await input.db
    .select({ userId: cellarMembers.userId })
    .from(cellarMembers)
    .where(and(eq(cellarMembers.cellarId, access.id), eq(cellarMembers.userId, input.userId)));
  if (!stillOwner || !stillMember) {
    throw new ApiError("not_found");
  }
  await input.db.batch([
    input.db
      .update(cellars)
      .set({ ownerUserId: input.userId, updatedAt: now, revision: sql`${cellars.revision} + 1` })
      .where(and(eq(cellars.id, access.id), eq(cellars.ownerUserId, stillOwner.ownerUserId))),
    input.db
      .update(cellarOwnerTransfers)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(cellarOwnerTransfers.id, row.id)),
    input.db.insert(cellarActivity).values({
      id: crypto.randomUUID(),
      cellarId: access.id,
      actorUserId: input.userId,
      action: "owner_transferred",
      bottleId: null,
      bottleName: null,
      createdAt: now,
    }),
  ]);
  return getCellar(input.db, input.userId, access.id);
}

export async function listActivity(input: {
  db: AppBatchDb;
  userId: string;
  cellarId: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: CellarActivityItem[]; nextCursor: string | null }> {
  const access = await requireCellarMember(input.db, input.userId, input.cellarId);
  const conditions = [eq(cellarActivity.cellarId, access.id)];
  if (input.cursor) {
    const cursor = decodeActivityCursor(input.cursor);
    conditions.push(
      sql`(${cellarActivity.createdAt} < ${cursor.at} or (${cellarActivity.createdAt} = ${cursor.at} and ${cellarActivity.id} < ${cursor.id}))`,
    );
  }
  const fetched = await input.db
    .select()
    .from(cellarActivity)
    .where(and(...conditions))
    .orderBy(desc(cellarActivity.createdAt), desc(cellarActivity.id))
    .limit(input.limit + 1);
  const page = fetched.slice(0, input.limit);
  const names = await displayNamesById(
    input.db,
    page.map((row) => row.actorUserId),
  );
  const last = page.at(-1);
  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action,
      actorName: actorDisplayName(row.actorUserId, names),
      bottleName: row.bottleName,
      createdAt: requireIso(row.createdAt),
    })),
    nextCursor:
      fetched.length > input.limit && last
        ? encodeActivityCursor(last.id, last.createdAt.getTime())
        : null,
  };
}

const activityCursorSchema = z
  .object({
    id: z.string().uuid(),
    at: z.number().int(),
  })
  .strict();

function encodeActivityCursor(id: string, at: number): string {
  return btoa(JSON.stringify({ id, at }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeActivityCursor(cursor: string): z.infer<typeof activityCursorSchema> {
  try {
    const base64 = cursor.replaceAll("-", "+").replaceAll("/", "_");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed = activityCursorSchema.safeParse(JSON.parse(atob(padded)));
    if (!parsed.success) {
      throw new ApiError("validation_error", {
        fields: { cursor: ["ページ情報が正しくありません"] },
      });
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("validation_error", {
      fields: { cursor: ["ページ情報が正しくありません"] },
    });
  }
}

export async function moveBottlesToShared(input: {
  db: AppBatchDb;
  userId: string;
  sharedCellarId: string;
  body: MoveBottlesInput;
  requestHash: string;
  now?: Date;
}): Promise<{ moved: number }> {
  const access = await requireCellarMember(input.db, input.userId, input.sharedCellarId);
  if (access.kind !== "shared") {
    throw new ApiError("not_found");
  }
  if (input.body.items.length > CELLAR_MOVE_MAX) {
    throw new ApiError("validation_error", {
      fields: { items: [`一度に移せるのは${CELLAR_MOVE_MAX}本までです`] },
    });
  }
  const cached = await readIdempotentResult<{ moved: number }>(input.db, {
    actorUserId: input.userId,
    cellarId: access.id,
    operationKey: input.body.operationKey,
    requestHash: input.requestHash,
  });
  if (cached) {
    return cached;
  }
  const personalId = await ensurePersonalCellar(input.db, input.userId, input.now);
  const now = input.now ?? new Date();
  const ids = input.body.items.map((item) => item.bottleId);
  const expected = new Map(input.body.items.map((item) => [item.bottleId, item.expectedVersion]));
  const rows = await input.db
    .select()
    .from(bottles)
    .where(and(inArray(bottles.id, ids), eq(bottles.cellarId, personalId)));
  if (rows.length !== ids.length || new Set(ids).size !== ids.length) {
    throw new ApiError("not_found");
  }
  for (const row of rows) {
    if (row.version !== expected.get(row.id)) {
      throw new ApiError("conflict", {
        fields: { expectedVersion: ["別のメンバーが更新しました。保存前に変更を確認してください"] },
        conflict: { reason: "version", current: { id: row.id, version: row.version } },
      });
    }
  }

  const statements: BatchItem<"sqlite">[] = [
    input.db
      .update(bottles)
      .set({
        cellarId: access.id,
        version: sql`${bottles.version} + 1`,
        updatedBy: input.userId,
        updatedAt: now,
      })
      .where(
        and(
          inArray(bottles.id, ids),
          eq(bottles.cellarId, personalId),
          sql`${bottles.cellarId} IN (SELECT cellar_id FROM cellar_members WHERE user_id = ${input.userId})`,
        ),
      ),
    input.db
      .update(photos)
      .set({ cellarId: access.id, userId: null, updatedAt: now })
      .where(and(inArray(photos.bottleId, ids), eq(photos.cellarId, personalId))),
    bumpCellarRevision(input.db, personalId, now),
    bumpCellarRevision(input.db, access.id, now),
  ];
  for (const row of rows) {
    statements.push(
      input.db.insert(cellarActivity).values({
        id: crypto.randomUUID(),
        cellarId: access.id,
        actorUserId: input.userId,
        action: "bottle_moved_in",
        bottleId: row.id,
        bottleName: row.name,
        createdAt: now,
      }),
    );
    statements.push(
      input.db.insert(cellarActivity).values({
        id: crypto.randomUUID(),
        cellarId: personalId,
        actorUserId: input.userId,
        action: "bottle_moved_out",
        bottleId: row.id,
        bottleName: row.name,
        createdAt: now,
      }),
    );
  }
  statements.push(
    idempotencyInsert(input.db, {
      actorUserId: input.userId,
      cellarId: access.id,
      operationKey: input.body.operationKey,
      requestHash: input.requestHash,
      result: { moved: rows.length },
      now,
    }),
  );
  const [first, ...rest] = statements;
  if (!first) {
    throw new ApiError("internal_error");
  }
  await input.db.batch([first, ...rest]);

  const moved = await input.db
    .select({ id: bottles.id })
    .from(bottles)
    .where(and(inArray(bottles.id, ids), eq(bottles.cellarId, access.id)));
  if (moved.length !== ids.length) {
    throw new ApiError("conflict", {
      fields: { "": ["移動に失敗しました。もう一度試してください"] },
      conflict: { reason: "version" },
    });
  }
  return { moved: ids.length };
}

export async function purgeExpiredCellarRows(db: AppBatchDb, nowMs = Date.now()): Promise<void> {
  const now = new Date(nowMs);
  await db
    .update(cellarOwnerTransfers)
    .set({ status: "expired" })
    .where(
      and(eq(cellarOwnerTransfers.status, "pending"), lt(cellarOwnerTransfers.expiresAt, now)),
    );
  await db
    .delete(cellarActivity)
    .where(lt(cellarActivity.createdAt, new Date(nowMs - CELLAR_ACTIVITY_TTL_MS)));
}

export function sharedCellarDefaultName(): string {
  return CELLAR_DEFAULT_SHARED_NAME;
}

export { or };
