import { z } from "zod";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN, VOLUME_ML_MAX, VOLUME_ML_MIN } from "./alcohol.ts";
import { DRINK_TYPES } from "./constants.ts";
import { photoMetaSchema } from "./photos.ts";
import { addCalendarDays, parseCalendarDate, TOKYO_TIME_ZONE } from "./tokyo-date.ts";

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
  patchEmpty: "変更する項目を指定してください",
  date: "日付の形式が正しくありません",
  range: "期間は31日以内で指定してください",
  filter: "日付または期間を指定してください",
  limit: "件数は1以上100以下で指定してください",
  cursor: "ページ情報が正しくありません",
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

export const updateDrinkLogSchema = z
  .object({
    drinkType: drinkTypeSchema.optional(),
    volumeMl: volumeMlSchema.optional(),
    abvPercent: abvPercentSchema.optional(),
    drunkAt: drunkAtSchema.optional(),
    memo: memoSchema.nullable().optional(),
    myDrinkId: referenceId.nullable().optional(),
    bottleId: referenceId.nullable().optional(),
    photoIds: z
      .array(referenceId)
      .max(DRINK_LOG_PHOTO_MAX, { error: DRINK_LOG_MESSAGES.photoIdsMax })
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: DRINK_LOG_MESSAGES.patchEmpty });

export type UpdateDrinkLogInput = z.infer<typeof updateDrinkLogSchema>;

const calendarDateSchema = z
  .string({ error: DRINK_LOG_MESSAGES.date })
  .refine((value) => parseCalendarDate(value) !== null, { error: DRINK_LOG_MESSAGES.date });

export const drinkLogsQuerySchema = z
  .object({
    date: calendarDateSchema.optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    bottleId: referenceId.optional(),
    limit: z.coerce
      .number({ error: DRINK_LOG_MESSAGES.limit })
      .int({ error: DRINK_LOG_MESSAGES.limit })
      .min(1, { error: DRINK_LOG_MESSAGES.limit })
      .max(100, { error: DRINK_LOG_MESSAGES.limit })
      .default(50),
    cursor: z
      .string({ error: DRINK_LOG_MESSAGES.cursor })
      .min(1, { error: DRINK_LOG_MESSAGES.cursor })
      .max(256, { error: DRINK_LOG_MESSAGES.cursor })
      .optional(),
  })
  .strict()
  .superRefine((query, context) => {
    const hasRangePart = query.from !== undefined || query.to !== undefined;
    if (query.date && hasRangePart) {
      context.addIssue({ code: "custom", path: [""], message: DRINK_LOG_MESSAGES.filter });
      return;
    }
    if (hasRangePart && (!query.from || !query.to)) {
      context.addIssue({ code: "custom", path: [""], message: DRINK_LOG_MESSAGES.filter });
      return;
    }
    if (!query.date && !hasRangePart && !query.bottleId) {
      context.addIssue({ code: "custom", path: [""], message: DRINK_LOG_MESSAGES.filter });
      return;
    }
    if (query.from && query.to) {
      if (query.from > query.to || query.to > addCalendarDays(query.from, 31)) {
        context.addIssue({ code: "custom", path: ["to"], message: DRINK_LOG_MESSAGES.range });
      }
    }
  });

export type DrinkLogsQuery = z.infer<typeof drinkLogsQuerySchema>;

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
export type DrinkLogSummaryDay = z.infer<typeof drinkLogSummaryDaySchema>;

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

/** 一覧行の形（spec/api-design.md 4.3 共通オブジェクト） */
export const drinkLogItemSchema = z.object({
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DrinkLogItem = z.infer<typeof drinkLogItemSchema>;

/** `GET /:id` と作成応答は一覧行に写真メタを加える。 */
export const drinkLogSchema = drinkLogItemSchema.extend({
  photos: z.array(photoMetaSchema),
});

export type DrinkLog = z.infer<typeof drinkLogSchema>;

export const drinkLogsResponseSchema = z
  .object({
    items: z.array(drinkLogItemSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().min(0),
    totalAlcoholG: z.number().min(0),
    /** X7: 表示日以外も含め、本人に記録が1件でもあるか */
    hasAnyLogs: z.boolean(),
  })
  .strict();

export type DrinkLogsResponse = z.infer<typeof drinkLogsResponseSchema>;

/** 前後空白を除いて空なら null（spec/features/drink-log.md E16） */
export function normalizeMemo(memo: string | null | undefined): string | null {
  if (memo === null || memo === undefined) {
    return null;
  }
  const trimmed = memo.trim();
  return trimmed.length === 0 ? null : trimmed;
}
