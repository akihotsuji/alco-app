import { and, eq, sql } from "drizzle-orm";
import type { AppSqliteDb } from "@/db/index.ts";
import { aiUsage } from "@/db/schema.ts";
import { AI_RECOGNIZE_DAILY_LIMIT } from "@/shared/constants.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";

export async function tryConsumeAiUsage(input: {
  db: AppSqliteDb;
  userId: string;
  now?: Date;
  limit?: number;
}): Promise<{ count: number } | null> {
  const usedOn = tokyoToday(input.now);
  const limit = input.limit ?? AI_RECOGNIZE_DAILY_LIMIT;
  const rows = await input.db
    .insert(aiUsage)
    .values({ userId: input.userId, usedOn, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.usedOn],
      set: { count: sql`${aiUsage.count} + 1` },
      where: sql`${aiUsage.count} < ${limit}`,
    })
    .returning({ count: aiUsage.count });
  const count = rows[0]?.count;
  if (count === undefined) {
    return null;
  }
  return { count };
}

export async function refundAiUsage(input: {
  db: AppSqliteDb;
  userId: string;
  now?: Date;
}): Promise<void> {
  const usedOn = tokyoToday(input.now);
  await input.db
    .update(aiUsage)
    .set({ count: sql`max(${aiUsage.count} - 1, 0)` })
    .where(and(eq(aiUsage.userId, input.userId), eq(aiUsage.usedOn, usedOn)));
}
