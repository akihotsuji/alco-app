import { and, eq, lt } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { cellarIdempotency } from "@/db/schema.ts";
import { CELLAR_IDEMPOTENCY_TTL_MS } from "@/shared/constants.ts";
import { ApiError } from "../errors.ts";

export async function readIdempotentResult<T>(
  db: AppBatchDb,
  input: {
    actorUserId: string;
    cellarId: string;
    operationKey: string | undefined;
    requestHash: string;
  },
): Promise<T | null> {
  if (!input.operationKey) {
    return null;
  }
  const [row] = await db
    .select()
    .from(cellarIdempotency)
    .where(
      and(
        eq(cellarIdempotency.actorUserId, input.actorUserId),
        eq(cellarIdempotency.cellarId, input.cellarId),
        eq(cellarIdempotency.operationKey, input.operationKey),
      ),
    );
  if (!row) {
    return null;
  }
  if (row.requestHash !== input.requestHash) {
    throw new ApiError("conflict", {
      fields: { operationKey: ["同じ操作キーで異なる内容は実行できません"] },
      conflict: { reason: "idempotency" },
    });
  }
  return JSON.parse(row.resultJson) as T;
}

export function idempotencyInsert(
  db: AppBatchDb,
  input: {
    actorUserId: string;
    cellarId: string;
    operationKey: string;
    requestHash: string;
    result: unknown;
    now: Date;
  },
) {
  return db.insert(cellarIdempotency).values({
    actorUserId: input.actorUserId,
    cellarId: input.cellarId,
    operationKey: input.operationKey,
    requestHash: input.requestHash,
    resultJson: JSON.stringify(input.result),
    createdAt: input.now,
  });
}

export async function recoverIdempotentResult<T>(
  db: AppBatchDb,
  input: {
    actorUserId: string;
    cellarId: string;
    operationKey: string | undefined;
    requestHash: string;
  },
): Promise<T | null> {
  if (!input.operationKey) {
    return null;
  }
  return readIdempotentResult<T>(db, input);
}

export async function purgeExpiredIdempotency(db: AppBatchDb, nowMs = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - CELLAR_IDEMPOTENCY_TTL_MS);
  const deleted = await db
    .delete(cellarIdempotency)
    .where(lt(cellarIdempotency.createdAt, cutoff))
    .returning({ actorUserId: cellarIdempotency.actorUserId });
  return deleted.length;
}
