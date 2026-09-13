import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import {
  accountDeletionPhotoTasks,
  accountDeletionRecords,
  photoObjectReservations,
  user as users,
} from "@/db/schema.ts";
import {
  ACCOUNT_DELETION_LEDGER_PREFIX,
  ACCOUNT_DELETION_TASK_BATCH_SIZE,
  ACCOUNT_DELETION_TASK_LEASE_MS,
} from "@/shared/account-deletion.ts";
import type { PhotoBucket } from "./photos.ts";
import { classifyR2DeleteError, deletePhotoR2Objects, deleteR2Object } from "./r2-delete.ts";

export type AccountDeletionJobResult = {
  photosDeleted: number;
  reservationsReclaimed: number;
  ledgerReplicated: number;
  overdueTasks: number;
};

function backoffMs(attemptCount: number): number {
  const minutes = Math.min(2 ** Math.max(attemptCount - 1, 0), 60);
  return minutes * 60 * 1000;
}

export async function reclaimExpiredReservations(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  now: Date;
}): Promise<number> {
  const expired = await input.db
    .select()
    .from(photoObjectReservations)
    .where(lte(photoObjectReservations.leaseUntil, input.now));

  let reclaimed = 0;
  for (const row of expired) {
    const [alive] = await input.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, row.userId));
    if (!alive) {
      const requestId = `reservation-orphan:${row.r2Key}`;
      await input.db
        .insert(accountDeletionPhotoTasks)
        .values({
          r2Key: row.r2Key,
          requestId,
          status: "pending",
          attemptCount: 0,
          nextAttemptAt: input.now,
          createdAt: input.now,
        })
        .onConflictDoNothing();
      await input.db
        .delete(photoObjectReservations)
        .where(eq(photoObjectReservations.r2Key, row.r2Key));
      reclaimed += 1;
      continue;
    }
    try {
      await deleteR2Object(input.bucket, row.r2Key);
      await input.db
        .delete(photoObjectReservations)
        .where(eq(photoObjectReservations.r2Key, row.r2Key));
      reclaimed += 1;
    } catch {
      // R2 障害時は予約を残す
    }
  }
  return reclaimed;
}

export async function processAccountDeletionPhotoTasks(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  now: Date;
  limit?: number;
}): Promise<number> {
  const limit = input.limit ?? ACCOUNT_DELETION_TASK_BATCH_SIZE;
  const due = await input.db
    .select()
    .from(accountDeletionPhotoTasks)
    .where(
      and(
        or(
          eq(accountDeletionPhotoTasks.status, "pending"),
          eq(accountDeletionPhotoTasks.status, "leased"),
        ),
        lte(accountDeletionPhotoTasks.nextAttemptAt, input.now),
        or(
          isNull(accountDeletionPhotoTasks.leaseUntil),
          lte(accountDeletionPhotoTasks.leaseUntil, input.now),
        ),
      ),
    )
    .limit(limit);

  let deleted = 0;
  for (const task of due) {
    const leaseUntil = new Date(input.now.getTime() + ACCOUNT_DELETION_TASK_LEASE_MS);
    const claimed = await input.db
      .update(accountDeletionPhotoTasks)
      .set({
        status: "leased",
        leaseUntil,
        attemptCount: task.attemptCount + 1,
      })
      .where(
        and(
          eq(accountDeletionPhotoTasks.r2Key, task.r2Key),
          or(
            eq(accountDeletionPhotoTasks.status, "pending"),
            and(
              eq(accountDeletionPhotoTasks.status, "leased"),
              or(
                isNull(accountDeletionPhotoTasks.leaseUntil),
                lte(accountDeletionPhotoTasks.leaseUntil, input.now),
              ),
            ),
          ),
        ),
      )
      .returning({ r2Key: accountDeletionPhotoTasks.r2Key });
    if (claimed.length === 0) {
      continue;
    }

    try {
      await deletePhotoR2Objects(input.bucket, task.r2Key);
      await input.db
        .delete(accountDeletionPhotoTasks)
        .where(eq(accountDeletionPhotoTasks.r2Key, task.r2Key));
      deleted += 1;
    } catch (error) {
      const next = new Date(input.now.getTime() + backoffMs(task.attemptCount + 1));
      await input.db
        .update(accountDeletionPhotoTasks)
        .set({
          status: "pending",
          nextAttemptAt: next,
          leaseUntil: null,
          lastErrorCode: classifyR2DeleteError(error),
        })
        .where(eq(accountDeletionPhotoTasks.r2Key, task.r2Key));
    }
  }
  return deleted;
}

function ledgerKey(userId: string): string {
  return `${ACCOUNT_DELETION_LEDGER_PREFIX}${userId}`;
}

export async function replicateAccountDeletionLedger(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  now: Date;
}): Promise<number> {
  const pending = await input.db
    .select()
    .from(accountDeletionRecords)
    .where(isNull(accountDeletionRecords.replicatedAt))
    .limit(ACCOUNT_DELETION_TASK_BATCH_SIZE);

  let replicated = 0;
  for (const row of pending) {
    const body = new TextEncoder().encode(
      JSON.stringify({
        userId: row.userId,
        requestId: row.requestId,
        deletedAt: row.deletedAt.toISOString(),
      }),
    );
    try {
      await input.bucket.put(ledgerKey(row.userId), body, {
        httpMetadata: { contentType: "application/json" },
      });
      await input.db
        .update(accountDeletionRecords)
        .set({ replicatedAt: input.now })
        .where(eq(accountDeletionRecords.userId, row.userId));
      replicated += 1;
    } catch {
      // 未転記のまま残す
    }
  }
  return replicated;
}

export async function countOverdueAccountDeletionTasks(db: AppBatchDb, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(accountDeletionPhotoTasks)
    .where(
      and(
        or(
          eq(accountDeletionPhotoTasks.status, "pending"),
          eq(accountDeletionPhotoTasks.status, "leased"),
        ),
        lte(accountDeletionPhotoTasks.createdAt, cutoff),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function runAccountDeletionJobs(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
  nowMs?: number;
}): Promise<AccountDeletionJobResult> {
  const now = new Date(input.nowMs ?? Date.now());
  const reservationsReclaimed = await reclaimExpiredReservations({
    db: input.db,
    bucket: input.bucket,
    now,
  });
  const photosDeleted = await processAccountDeletionPhotoTasks({
    db: input.db,
    bucket: input.bucket,
    now,
  });
  const ledgerReplicated = await replicateAccountDeletionLedger({
    db: input.db,
    bucket: input.bucket,
    now,
  });
  const overdueTasks = await countOverdueAccountDeletionTasks(input.db, now);
  console.info(
    `[account-deletion] photos=${photosDeleted} reservations=${reservationsReclaimed} ledger=${ledgerReplicated} overdue=${overdueTasks}`,
  );
  return { photosDeleted, reservationsReclaimed, ledgerReplicated, overdueTasks };
}

export async function hasUnreplicatedAccountDeletionRecords(db: AppBatchDb): Promise<boolean> {
  const [row] = await db
    .select({ userId: accountDeletionRecords.userId })
    .from(accountDeletionRecords)
    .where(isNull(accountDeletionRecords.replicatedAt))
    .limit(1);
  return Boolean(row);
}

function userIdFromLedgerKey(key: string): string | null {
  if (!key.startsWith(ACCOUNT_DELETION_LEDGER_PREFIX)) {
    return null;
  }
  const userId = key.slice(ACCOUNT_DELETION_LEDGER_PREFIX.length);
  if (!userId || userId.includes("/")) {
    return null;
  }
  return userId;
}

export async function reapplyAccountDeletionLedger(input: {
  db: AppBatchDb;
  bucket: PhotoBucket;
}): Promise<number> {
  const listed = await input.bucket.list(ACCOUNT_DELETION_LEDGER_PREFIX);
  let deleted = 0;
  for (const object of listed.objects) {
    const userId = userIdFromLedgerKey(object.key);
    if (!userId) {
      continue;
    }
    const item = await input.bucket.get(object.key);
    if (!item) {
      continue;
    }
    let body: { userId?: unknown };
    try {
      body = JSON.parse(new TextDecoder().decode(await item.arrayBuffer())) as { userId?: unknown };
    } catch {
      continue;
    }
    if (body.userId !== userId) {
      continue;
    }
    await input.db.delete(users).where(eq(users.id, userId));
    deleted += 1;
  }
  return deleted;
}
