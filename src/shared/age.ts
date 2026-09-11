import { z } from "zod";
import { addCalendarDays, addCalendarYears, parseCalendarDate, tokyoToday } from "./tokyo-date.ts";

/** 日本の飲酒年齢。満了は 20 歳の誕生日の前日（spec/features/age-verification.md）。 */
export const AGE_MAJORITY_YEARS = 20;
export const AGE_BIRTH_YEAR_MIN = 1900;

export const AGE_BIRTH_ON_MESSAGE = "生年月日を確認してください";

/** 満 `years` 歳に達する JST 暦日（誕生日の前日）。 */
export function majorityReachedOn(birthOn: string, years = AGE_MAJORITY_YEARS): string {
  return addCalendarDays(addCalendarYears(birthOn, years), -1);
}

/** `today`（YYYY-MM-DD）時点で満 `years` 歳以上か。不正な日付は false。 */
export function isAtLeastAge(birthOn: string, today: string, years = AGE_MAJORITY_YEARS): boolean {
  if (!parseCalendarDate(birthOn) || !parseCalendarDate(today)) {
    return false;
  }
  return today >= majorityReachedOn(birthOn, years);
}

export function isAtLeastAgeOnTokyoToday(
  birthOn: string,
  now: Date = new Date(),
  years = AGE_MAJORITY_YEARS,
): boolean {
  return isAtLeastAge(birthOn, tokyoToday(now), years);
}

export const birthOnSchema = z.string().refine((value) => parseCalendarDate(value) !== null, {
  message: AGE_BIRTH_ON_MESSAGE,
});

export const verifyAgeBodySchema = z
  .object({
    birthOn: birthOnSchema,
  })
  .strict();

export type VerifyAgeBody = z.infer<typeof verifyAgeBodySchema>;

export const ageVerificationResponseSchema = z.object({
  ageVerified: z.literal(true),
});

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  ageVerified: z.boolean(),
  hasPassword: z.boolean(),
  hasGoogle: z.boolean(),
});

export type Me = z.infer<typeof meSchema>;
