import { and, eq, isNull, lt } from "drizzle-orm";
import type { AppSqliteDb } from "@/db/index.ts";
import { aiUsage, photos } from "@/db/schema.ts";
import {
  AI_USAGE_RETENTION_DAYS,
  PHOTO_GC_BATCH_SIZE,
  PHOTO_GC_TTL_MS,
} from "@/shared/constants.ts";
import { addCalendarDays, tokyoToday } from "@/shared/tokyo-date.ts";
import type { PhotoBucket } from "./photos.ts";

export type DailyGcResult = {
  photosDeleted: number;
  aiUsageDeleted: number;
};

export async function sweepUnattachedPhotos(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  nowMs: number;
}): Promise<number> {
  const cutoff = new Date(input.nowMs - PHOTO_GC_TTL_MS);
  const stale = await input.db
    .select({ id: photos.id, r2Key: photos.r2Key })
    .from(photos)
    .where(
      and(
        isNull(photos.bottleId),
        isNull(photos.tastingNoteId),
        isNull(photos.drinkLogId),
        lt(photos.createdAt, cutoff),
      ),
    );

  let deleted = 0;
  for (const row of stale.slice(0, PHOTO_GC_BATCH_SIZE)) {
    try {
      await input.bucket.delete(row.r2Key);
    } catch {
      // R2 が 404 相当でも D1 は消す
    }
    await input.db.delete(photos).where(eq(photos.id, row.id));
    deleted += 1;
  }
  return deleted;
}

export async function sweepStaleAiUsage(input: {
  db: AppSqliteDb;
  nowMs: number;
}): Promise<number> {
  const cutoff = addCalendarDays(tokyoToday(new Date(input.nowMs)), -AI_USAGE_RETENTION_DAYS);
  const stale = await input.db
    .select({ userId: aiUsage.userId, usedOn: aiUsage.usedOn })
    .from(aiUsage)
    .where(lt(aiUsage.usedOn, cutoff));
  if (stale.length === 0) {
    return 0;
  }
  await input.db.delete(aiUsage).where(lt(aiUsage.usedOn, cutoff));
  return stale.length;
}

export async function runDailyGc(input: {
  db: AppSqliteDb;
  bucket: PhotoBucket;
  nowMs: number;
}): Promise<DailyGcResult> {
  const photosDeleted = await sweepUnattachedPhotos(input);
  const aiUsageDeleted = await sweepStaleAiUsage(input);
  console.info(`[gc] photos=${photosDeleted} ai_usage=${aiUsageDeleted}`);
  return { photosDeleted, aiUsageDeleted };
}
