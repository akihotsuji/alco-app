import { z } from "zod";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN, VOLUME_ML_MAX, VOLUME_ML_MIN } from "./alcohol.ts";
import { DRINK_TYPES } from "./constants.ts";
import { photoMetaSchema } from "./photos.ts";
import { parseCalendarDate, TOKYO_TIME_ZONE } from "./tokyo-date.ts";

/**
 * 飲酒記録の入力スキーマ。クライアント（即時表示）とサーバー（最終判定）で同じものを使う。
 * 規則とエラー文の正本: spec/features/drink-log.md 4.1
 */

/** サーバー現在時刻からの未来許容（時計ズレのみ） */
export const DRUNK_AT_FUTURE_TOLERANCE_MS = 15 * 60 * 1000;
export const MEMO_MAX_LENGTH = 500;
export const DRINK_NAME_MAX_LENGTH = 100;
export const DRINK_LOG_PHOTO_MAX = 1;

export const DRINK_LOG_MESSAGES = {
  drinkType: "種類を選んでください",
  volumeMl: `${VOLUME_ML_MIN}以上${VOLUME_ML_MAX}以下で入力してください`,
  abvPercent: `${ABV_PERCENT_MIN}以上${ABV_PERCENT_MAX}以下で入力してください`,
  abvDecimals: "小数点以下は1桁までです",
  drunkAtFormat: "日時の形式が正しくありません",
  drunkAtFuture: "未来の日時は指定できません",
  memo: `${MEMO_MAX_LENGTH}文字以内で入力してください`,
  photoIdsMax: `写真は${DRINK_LOG_PHOTO_MAX}枚まで添付できます`,
  photoNotFound: "写真をもう一度撮ってください",
  bottleNotFound: "ボトルが見つかりません",
  myDrinkNotFound: "マイドリンクが見つかりません",
} as const;

/** 小数第 1 位まで（`multipleOf` は浮動小数で誤判定するため refine で見る） */
export function hasAtMostOneDecimal(value: number): boolean {
  return Number.isFinite(value) && Math.round(value * 10) / 10 === value;
}

export function isDrunkAtAllowed(drunkAt: Date, now: Date = new Date()): boolean {
  return drunkAt.getTime() <= now.getTime() + DRUNK_AT_FUTURE_TOLERANCE_MS;
}

export const drinkTypeSchema = z.enum(DRINK_TYPES, { error: DRINK_LOG_MESSAGES.drinkType });

export const volumeMlSchema = z
  .number({ error: DRINK_LOG_MESSAGES.volumeMl })
  .int({ error: DRINK_LOG_MESSAGES.volumeMl })
  .min(VOLUME_ML_MIN, { error: DRINK_LOG_MESSAGES.volumeMl })
  .max(VOLUME_ML_MAX, { error: DRINK_LOG_MESSAGES.volumeMl });

export const abvPercentSchema = z
  .number({ error: DRINK_LOG_MESSAGES.abvPercent })
  .min(ABV_PERCENT_MIN, { error: DRINK_LOG_MESSAGES.abvPercent })
  .max(ABV_PERCENT_MAX, { error: DRINK_LOG_MESSAGES.abvPercent })
  .refine(hasAtMostOneDecimal, { error: DRINK_LOG_MESSAGES.abvDecimals });

export const drunkAtSchema = z.iso
  .datetime({ error: DRINK_LOG_MESSAGES.drunkAtFormat })
  .refine((value) => isDrunkAtAllowed(new Date(value)), {
    error: DRINK_LOG_MESSAGES.drunkAtFuture,
  });

export const memoSchema = z
  .string({ error: DRINK_LOG_MESSAGES.memo })
  .max(MEMO_MAX_LENGTH, { error: DRINK_LOG_MESSAGES.memo });

const referenceId = z.string().uuid();

export const createDrinkLogSchema = z
  .object({
    drinkType: drinkTypeSchema,
    volumeMl: volumeMlSchema,
    abvPercent: abvPercentSchema,
    drunkAt: drunkAtSchema.optional(),
    memo: memoSchema.nullable().optional(),
    myDrinkId: referenceId.nullable().optional(),
    bottleId: referenceId.nullable().optional(),
    photoIds: z
      .array(referenceId)
      .max(DRINK_LOG_PHOTO_MAX, { error: DRINK_LOG_MESSAGES.photoIdsMax })
      .optional(),
  })
  .strict();

export type CreateDrinkLogInput = z.infer<typeof createDrinkLogSchema>;

export const drinkLogIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const DRINK_LOG_SUMMARY_MESSAGES = {
  period: "期間の種類が正しくありません",
  date: "日付の形式が正しくありません",
} as const;

export const drinkLogSummaryQuerySchema = z
  .object({
    period: z.enum(["day", "week", "month"], {
      error: DRINK_LOG_SUMMARY_MESSAGES.period,
    }),
    date: z
      .string({ error: DRINK_LOG_SUMMARY_MESSAGES.date })
      .refine((value) => parseCalendarDate(value) !== null, {
        error: DRINK_LOG_SUMMARY_MESSAGES.date,
      }),
  })
  .strict();
export type DrinkLogSummaryQuery = z.infer<typeof drinkLogSummaryQuerySchema>;

export const drinkLogSummaryDaySchema = z
  .object({
    date: z.string(),
    count: z.number().int().min(0),
    alcoholG: z.number().min(0),
    isDryDay: z.boolean(),
    isFuture: z.boolean(),
  })
  .strict();

export const drinkLogSummarySchema = z
  .object({
    period: z.enum(["day", "week", "month"]),
    from: z.string(),
    to: z.string(),
    timezone: z.literal(TOKYO_TIME_ZONE),
    totalCount: z.number().int().min(0),
    totalAlcoholG: z.number().min(0),
    dryDayCount: z.number().int().min(0),
    days: z.array(drinkLogSummaryDaySchema),
  })
  .strict();
export type DrinkLogSummary = z.infer<typeof drinkLogSummarySchema>;

/** `GET /:id` と作成応答の形（spec/api-design.md 4.3 共通オブジェクト + `photos`） */
export const drinkLogSchema = z.object({
  id: z.string(),
  drunkAt: z.string(),
  drunkOn: z.string(),
  drinkType: drinkTypeSchema,
  drinkName: z.string().nullable(),
  volumeMl: z.number().int(),
  abvPercent: z.number(),
  alcoholG: z.number(),
  memo: z.string().nullable(),
  myDrinkId: z.string().nullable(),
  bottleId: z.string().nullable(),
  thumbPhotoId: z.string().nullable(),
  photos: z.array(photoMetaSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DrinkLog = z.infer<typeof drinkLogSchema>;

/** 前後空白を除いて空なら null（spec/features/drink-log.md E16） */
export function normalizeMemo(memo: string | null | undefined): string | null {
  if (memo === null || memo === undefined) {
    return null;
  }
  const trimmed = memo.trim();
  return trimmed.length === 0 ? null : trimmed;
}
