import { z } from "zod";
import { BOTTLE_STATUSES, DRINK_TYPES, type DrinkType, PHOTO_KINDS } from "./constants.ts";
import { drinkTypeSchema } from "./drink-logs.ts";
import {
  IDENTITY_FIELD_LABELS,
  IDENTITY_TEXT_MAX_LENGTH,
  normalizeOptionalText,
  VINTAGE_MAX,
  VINTAGE_MIN,
  vintageSchema,
} from "./identity.ts";
import { photoMetaSchema } from "./photos.ts";
import { parseCalendarDate, tokyoToday } from "./tokyo-date.ts";

export {
  normalizeOptionalText,
  VINTAGE_MAX as BOTTLE_VINTAGE_MAX,
  VINTAGE_MIN as BOTTLE_VINTAGE_MIN,
  vintageSchema,
};

/**
 * ボトルの入力スキーマ。クライアントとサーバーで同じものを使う。
 * 規則とエラー文の正本: spec/features/cellar.md 4 章
 */

export const BOTTLE_NAME_MAX_LENGTH = 100;
export const BOTTLE_TEXT_MAX_LENGTH = IDENTITY_TEXT_MAX_LENGTH;
export const BOTTLE_MEMO_MAX_LENGTH = 2000;
export const BOTTLE_COUNT_MIN = 1;
export const BOTTLE_COUNT_MAX = 12;
export const BOTTLE_PHOTO_MAX = 1;
export const BOTTLE_SEARCH_MAX_LENGTH = 100;

export const BOTTLE_VIEWS = ["cellar", "archive", "all"] as const;
export type BottleView = (typeof BOTTLE_VIEWS)[number];

export const DEFAULT_BOTTLE_STORAGE = "自宅セラー";

export const BOTTLE_MESSAGES = {
  name: `1文字以上${BOTTLE_NAME_MAX_LENGTH}文字以内で入力してください`,
  drinkType: "種類を選んでください",
  text: `${BOTTLE_TEXT_MAX_LENGTH}文字以内で入力してください`,
  vintage: `${VINTAGE_MIN}以上${VINTAGE_MAX}以下のヴィンテージを入力してください`,
  purchasedOn: "日付の形式が正しくありません",
  purchasedOnFuture: "未来の日付は指定できません",
  storedOn: "日付の形式が正しくありません",
  storedOnFuture: "未来の日付は指定できません",
  priceJpy: "0以上の整数で入力してください",
  memo: `${BOTTLE_MEMO_MAX_LENGTH}文字以内で入力してください`,
  count: `${BOTTLE_COUNT_MIN}以上${BOTTLE_COUNT_MAX}以下で入力してください`,
  photoIdsMax: `写真は${BOTTLE_PHOTO_MAX}枚まで添付できます`,
  photoNotFound: "写真をもう一度撮ってください",
  patchEmpty: "変更する項目を指定してください",
  view: "一覧の種類が正しくありません",
  q: `${BOTTLE_SEARCH_MAX_LENGTH}文字以内で入力してください`,
  limit: "件数は1以上100以下で指定してください",
  cursor: "ページ情報が正しくありません",
} as const;

export const BOTTLE_FIELD_LABELS = {
  name: IDENTITY_FIELD_LABELS.name,
  vintage: IDENTITY_FIELD_LABELS.vintage,
  variety: IDENTITY_FIELD_LABELS.variety,
  origin: IDENTITY_FIELD_LABELS.origin,
  producer: IDENTITY_FIELD_LABELS.producer,
  storedOn: "保管日",
  storage: "保管場所",
  purchasedOn: "購入日",
  priceJpy: "購入価格",
} as const;

const referenceId = z.string().uuid();

export function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function isPurchasedOnAllowed(value: string, now: Date = new Date()): boolean {
  return parseCalendarDate(value) !== null && value <= tokyoToday(now);
}

export const isStoredOnAllowed = isPurchasedOnAllowed;

export const bottleNameSchema = z
  .string({ error: BOTTLE_MESSAGES.name })
  .trim()
  .min(1, { error: BOTTLE_MESSAGES.name })
  .max(BOTTLE_NAME_MAX_LENGTH, { error: BOTTLE_MESSAGES.name });

export const bottleTextSchema = z
  .string({ error: BOTTLE_MESSAGES.text })
  .max(BOTTLE_TEXT_MAX_LENGTH, { error: BOTTLE_MESSAGES.text });

export const bottleMemoSchema = z
  .string({ error: BOTTLE_MESSAGES.memo })
  .max(BOTTLE_MEMO_MAX_LENGTH, { error: BOTTLE_MESSAGES.memo });

function bottleCalendarDateSchema(invalid: string, future: string) {
  return z
    .string({ error: invalid })
    .refine((value) => parseCalendarDate(value) !== null, { error: invalid })
    .refine((value) => parseCalendarDate(value) === null || isPurchasedOnAllowed(value), {
      error: future,
    });
}

export const purchasedOnSchema = bottleCalendarDateSchema(
  BOTTLE_MESSAGES.purchasedOn,
  BOTTLE_MESSAGES.purchasedOnFuture,
);

export const storedOnSchema = bottleCalendarDateSchema(
  BOTTLE_MESSAGES.storedOn,
  BOTTLE_MESSAGES.storedOnFuture,
);

export const priceJpySchema = z
  .number({ error: BOTTLE_MESSAGES.priceJpy })
  .int({ error: BOTTLE_MESSAGES.priceJpy })
  .min(0, { error: BOTTLE_MESSAGES.priceJpy });

export const bottleCountSchema = z
  .number({ error: BOTTLE_MESSAGES.count })
  .int({ error: BOTTLE_MESSAGES.count })
  .min(BOTTLE_COUNT_MIN, { error: BOTTLE_MESSAGES.count })
  .max(BOTTLE_COUNT_MAX, { error: BOTTLE_MESSAGES.count });

const bottleFields = {
  name: bottleNameSchema,
  drinkType: drinkTypeSchema,
  producer: bottleTextSchema.nullable().optional(),
  origin: bottleTextSchema.nullable().optional(),
  variety: bottleTextSchema.nullable().optional(),
  vintage: vintageSchema.nullable().optional(),
  purchasedOn: purchasedOnSchema.nullable().optional(),
  priceJpy: priceJpySchema.nullable().optional(),
  shop: bottleTextSchema.nullable().optional(),
  storedOn: storedOnSchema.nullable().optional(),
  storage: bottleTextSchema.nullable().optional(),
  memo: bottleMemoSchema.nullable().optional(),
  photoIds: z
    .array(referenceId)
    .max(BOTTLE_PHOTO_MAX, { error: BOTTLE_MESSAGES.photoIdsMax })
    .optional(),
};

export const createBottleSchema = z
  .object({
    ...bottleFields,
    count: bottleCountSchema.optional(),
  })
  .strict();

export type CreateBottleInput = z.infer<typeof createBottleSchema>;

export const updateBottleSchema = z
  .object({
    name: bottleFields.name.optional(),
    drinkType: bottleFields.drinkType.optional(),
    producer: bottleFields.producer,
    origin: bottleFields.origin,
    variety: bottleFields.variety,
    vintage: bottleFields.vintage,
    purchasedOn: bottleFields.purchasedOn,
    priceJpy: bottleFields.priceJpy,
    shop: bottleFields.shop,
    storedOn: bottleFields.storedOn,
    storage: bottleFields.storage,
    memo: bottleFields.memo,
    photoIds: bottleFields.photoIds,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: BOTTLE_MESSAGES.patchEmpty });

export type UpdateBottleInput = z.infer<typeof updateBottleSchema>;

export const bottlesQuerySchema = z
  .object({
    view: z.enum(BOTTLE_VIEWS, { error: BOTTLE_MESSAGES.view }).default("cellar"),
    q: z
      .string({ error: BOTTLE_MESSAGES.q })
      .max(BOTTLE_SEARCH_MAX_LENGTH, { error: BOTTLE_MESSAGES.q })
      .optional(),
    drinkType: drinkTypeSchema.optional(),
    limit: z.coerce
      .number({ error: BOTTLE_MESSAGES.limit })
      .int({ error: BOTTLE_MESSAGES.limit })
      .min(1, { error: BOTTLE_MESSAGES.limit })
      .max(100, { error: BOTTLE_MESSAGES.limit })
      .default(50),
    cursor: z
      .string({ error: BOTTLE_MESSAGES.cursor })
      .min(1, { error: BOTTLE_MESSAGES.cursor })
      .max(256, { error: BOTTLE_MESSAGES.cursor })
      .optional(),
  })
  .strict();

export type BottlesQuery = z.infer<typeof bottlesQuerySchema>;

export const bottleIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

/** consume / restore。ボディなし、または空オブジェクト。未知キー（log 等）は 400 */
export const emptyJsonBodySchema = z.object({}).strict();

export const bottleStatusSchema = z.enum(BOTTLE_STATUSES);

export const bottleItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    drinkType: drinkTypeSchema,
    producer: z.string().nullable(),
    origin: z.string().nullable(),
    variety: z.string().nullable(),
    vintage: z.number().int().nullable(),
    purchasedOn: z.string().nullable(),
    priceJpy: z.number().int().nullable(),
    shop: z.string().nullable(),
    storedOn: z.string().nullable(),
    storage: z.string().nullable(),
    memo: z.string().nullable(),
    status: bottleStatusSchema,
    consumedAt: z.string().nullable(),
    consumedOn: z.string().nullable(),
    thumbPhotoId: z.string().nullable(),
    thumbPhotoKind: z.enum(PHOTO_KINDS).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type BottleItem = z.infer<typeof bottleItemSchema>;

export const bottleSchema = bottleItemSchema.extend({
  photos: z.array(photoMetaSchema),
});

export type Bottle = z.infer<typeof bottleSchema>;

const countsByTypeShape = Object.fromEntries(
  DRINK_TYPES.map((type) => [type, z.number().int().min(0)]),
) as Record<DrinkType, z.ZodNumber>;

export const countsByTypeSchema = z.object(countsByTypeShape).strict();
export type CountsByType = z.infer<typeof countsByTypeSchema>;

export const bottlesResponseSchema = z
  .object({
    items: z.array(bottleItemSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().min(0),
    countsByType: countsByTypeSchema,
  })
  .strict();

export type BottlesResponse = z.infer<typeof bottlesResponseSchema>;

export const createBottlesResponseSchema = z
  .object({
    items: z.array(bottleSchema),
  })
  .strict();

export type CreateBottlesResponse = z.infer<typeof createBottlesResponseSchema>;

export function emptyCountsByType(): CountsByType {
  return Object.fromEntries(DRINK_TYPES.map((type) => [type, 0])) as CountsByType;
}

export function formatBottleCount(count: number): string {
  return `${count} 本`;
}

export function arrangedToastMessage(count: number): string {
  return count >= 2 ? `棚に ${count} 本並べました` : "棚に並べました";
}
