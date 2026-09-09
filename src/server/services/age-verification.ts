import { eq } from "drizzle-orm";
import type { AppBatchDb } from "@/db/index.ts";
import { ageVerifications } from "@/db/schema.ts";
import { AGE_BIRTH_ON_MESSAGE, AGE_BIRTH_YEAR_MIN, isAtLeastAge } from "@/shared/age.ts";
import { parseCalendarDate, tokyoToday } from "@/shared/tokyo-date.ts";
import { ApiError } from "../errors.ts";

export async function hasAgeVerification(db: AppBatchDb, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: ageVerifications.userId })
    .from(ageVerifications)
    .where(eq(ageVerifications.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function verifyAge(options: {
  db: AppBatchDb;
  userId: string;
  birthOn: string;
  now?: Date;
}): Promise<void> {
  const { db, userId, birthOn } = options;
  if (await hasAgeVerification(db, userId)) {
    return;
  }

  const today = tokyoToday(options.now);
  const parsed = parseCalendarDate(birthOn);
  if (!parsed || parsed.year < AGE_BIRTH_YEAR_MIN || birthOn > today) {
    throw new ApiError("validation_error", {
      fields: { birthOn: [AGE_BIRTH_ON_MESSAGE] },
    });
  }
  if (!isAtLeastAge(birthOn, today)) {
    throw new ApiError("age_restricted");
  }

  const now = options.now ?? new Date();
  await db.insert(ageVerifications).values({
    userId,
    birthOn,
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}
