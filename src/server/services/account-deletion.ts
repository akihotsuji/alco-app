import { and, eq, or, sql } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import {
  accountDeletionPhotoTasks,
  accountDeletionRecords,
  accountDeletionRequests,
  cellarMembers,
  cellars,
  userCellarSlots,
  user as users,
  verification,
} from "@/db/schema.ts";
import {
  ACCOUNT_DELETION_GOOGLE_SESSION_MAX_AGE_MS,
  type AccountDeletionBody,
} from "@/shared/account-deletion.ts";
import type { Auth } from "../auth.ts";
import { ApiError } from "../errors.ts";
import { listAuthProviders } from "./account-providers.ts";
import { evictRecognitionCacheForUser } from "./ai-recognition/cache.ts";
import { ensurePersonalCellar } from "./cellar-access.ts";
import { anonymizeSharedMembership, enqueueCellarPhotoTasks } from "./cellars.ts";

export type AcceptAccountDeletionInput = {
  db: AppBatchDb;
  auth: Auth;
  headers: Headers;
  userId: string;
  email: string;
  sessionCreatedAt: Date;
  body: AccountDeletionBody;
  now?: Date;
};

export async function acceptAccountDeletion(input: AcceptAccountDeletionInput): Promise<{
  requestId: string;
}> {
  const now = input.now ?? new Date();
  const providers = await listAuthProviders(input.db, input.userId);

  if (providers.hasPassword) {
    if (!input.body.password) {
      throw new ApiError("reauthentication_required");
    }
    await verifyCurrentPassword(input.auth, input.headers, input.body.password);
  } else if (providers.hasGoogle) {
    const ageMs = now.getTime() - input.sessionCreatedAt.getTime();
    if (ageMs > ACCOUNT_DELETION_GOOGLE_SESSION_MAX_AGE_MS || ageMs < 0) {
      throw new ApiError("reauthentication_required");
    }
  } else {
    throw new ApiError("reauthentication_required");
  }

  await prepareCellarsForAccountDeletion(input.db, input.userId, now);

  const requestId = crypto.randomUUID();
  const nowMs = now.getTime();
  const personalCellarId = await ensurePersonalCellar(input.db, input.userId, now);

  try {
    await input.db.batch([
      input.db.insert(accountDeletionRequests).values({
        id: requestId,
        createdAt: now,
      }),
      input.db
        .insert(accountDeletionPhotoTasks)
        .select(sql`
          SELECT r2_key, ${requestId}, 'pending', 0, ${nowMs}, NULL, NULL, ${nowMs}
          FROM photos
          WHERE user_id = ${input.userId}
        `)
        .onConflictDoNothing(),
      enqueueCellarPhotoTasks(input.db, personalCellarId, requestId, nowMs),
      input.db
        .insert(accountDeletionPhotoTasks)
        .select(sql`
          SELECT r2_key, ${requestId}, 'pending', 0, ${nowMs}, NULL, NULL, ${nowMs}
          FROM photo_object_reservations
          WHERE user_id = ${input.userId}
            AND lease_until <= ${nowMs}
        `)
        .onConflictDoNothing(),
      input.db.insert(accountDeletionRecords).values({
        userId: input.userId,
        requestId,
        deletedAt: now,
      }),
      input.db.delete(cellars).where(eq(cellars.id, personalCellarId)),
      input.db
        .delete(verification)
        .where(or(eq(verification.value, input.userId), eq(verification.identifier, input.email))),
      input.db.delete(users).where(eq(users.id, input.userId)),
    ]);
  } catch (error) {
    const [existing] = await input.db
      .select({ requestId: accountDeletionRecords.requestId })
      .from(accountDeletionRecords)
      .where(eq(accountDeletionRecords.userId, input.userId));
    const [alive] = await input.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId));
    if (existing && !alive) {
      evictRecognitionCacheForUser(input.userId);
      return { requestId: existing.requestId };
    }
    throw error;
  }

  evictRecognitionCacheForUser(input.userId);
  return { requestId };
}

async function prepareCellarsForAccountDeletion(
  db: AppBatchDb,
  userId: string,
  now: Date,
): Promise<void> {
  const [slot] = await db.select().from(userCellarSlots).where(eq(userCellarSlots.userId, userId));
  if (!slot?.sharedCellarId) {
    return;
  }
  const [shared] = await db.select().from(cellars).where(eq(cellars.id, slot.sharedCellarId));
  if (!shared) {
    return;
  }
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(cellarMembers)
    .where(eq(cellarMembers.cellarId, shared.id));
  const members = Number(countRow?.n ?? 0);
  if (shared.ownerUserId === userId && members > 1) {
    throw new ApiError("conflict", {
      fields: { "": ["所有権を移すか、共有セラーを削除してから退会してください"] },
      conflict: { reason: "owner_required" },
    });
  }
  if (shared.ownerUserId === userId) {
    const requestId = crypto.randomUUID();
    await db.batch([
      enqueueCellarPhotoTasks(db, shared.id, requestId, now.getTime()),
      db
        .update(userCellarSlots)
        .set({ sharedCellarId: null })
        .where(eq(userCellarSlots.userId, userId)),
      db.delete(cellars).where(eq(cellars.id, shared.id)),
    ]);
    return;
  }
  await anonymizeSharedMembership(db, shared.id, userId);
  await db.batch([
    db
      .delete(cellarMembers)
      .where(and(eq(cellarMembers.cellarId, shared.id), eq(cellarMembers.userId, userId))),
    db
      .update(userCellarSlots)
      .set({ sharedCellarId: null })
      .where(
        and(eq(userCellarSlots.userId, userId), eq(userCellarSlots.sharedCellarId, shared.id)),
      ),
  ]);
}

async function verifyCurrentPassword(
  auth: Auth,
  headers: Headers,
  password: string,
): Promise<void> {
  try {
    const result = await auth.api.verifyPassword({
      body: { password },
      headers,
    });
    if (!result.status) {
      throw new ApiError("reauthentication_required");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("reauthentication_required");
  }
}
