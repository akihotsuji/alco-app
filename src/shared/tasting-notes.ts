import { z } from "zod";
import { vintageSchema } from "./bottles.ts";
import { BOTTLE_STATUSES, PHOTO_OWNER_LIMITS } from "./constants.ts";
import { drinkTypeSchema } from "./drink-logs.ts";
import { photoMetaSchema } from "./photos.ts";
import { parseCalendarDate, tokyoToday } from "./tokyo-date.ts";

/**
 * テイスティングノートの入力スキーマ。クライアント（即時表示）とサーバー（最終判定）で同じものを使う。
 * 規則とエラー文の正本: spec/features/tasting-note.md 4 / 5 章
 */

export const RATING_X10_MIN = 10;
export const RATING_X10_MAX = 50;
export const RATING_X10_STEP = 5;
export const NOTE_TEXT_MAX_LENGTH = 2000;
export const NOTE_DRINK_NAME_MAX_LENGTH = 100;
export const NOTE_SEARCH_MAX_LENGTH = 100;
export const TASTING_NOTE_PHOTO_MAX = PHOTO_OWNER_LIMITS.tastingNote;
export const RATING_LIST_MIN_DEFAULT = 40;

export const TASTING_NOTE_MESSAGES = {
  rating: "評価を選んでください",
  ratingRange: "評価の範囲が正しくありません",
  tastedOnFormat: "日付の形式が正しくありません",
  tastedOnFuture: "未来の日付は指定できません",
  drinkName: `1文字以上${NOTE_DRINK_NAME_MAX_LENGTH}文字以内で入力してください`,
  drinkType: "種類を選んでください",
  noteText: `${NOTE_TEXT_MAX_LENGTH}文字以内で入力してください`,
  vintage: "1800以上2100以下のビンテージを入力してください",
  photoIdsMax: `写真は${TASTING_NOTE_PHOTO_MAX}枚まで添付できます`,
  photoIdsDuplicate: "写真の指定が正しくありません",
  photoNotFound: "写真をもう一度撮ってください",
  bottleNotFound: "ボトルが見つかりません",
  patchEmpty: "変更する項目を指定してください",
  q: `${NOTE_SEARCH_MAX_LENGTH}文字以内で入力してください`,
  limit: "件数は1以上100以下で指定してください",
  cursor: "ページ情報が正しくありません",
} as const;

export function isValidRatingX10(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= RATING_X10_MIN &&
    value <= RATING_X10_MAX &&
    value % RATING_X10_STEP === 0
  );
}

/** 表示は小数第 1 位（`4.0` / `4.5`） */
export function formatRatingX10(ratingX10: number): string {
  return (ratingX10 / 10).toFixed(1);
}

export function stepRatingX10(current: number | null, delta: -5 | 5): number {
  if (current === null) {
    return RATING_X10_MIN;
  }
  return Math.min(RATING_X10_MAX, Math.max(RATING_X10_MIN, current + delta));
}

export function ratingX10FromStar(star: number): number {
  return star * 10;
}

/** 星タップ。同じ星の再タップで +0.5。5.0 は上限 */
export function ratingX10FromStarTap(current: number | null, star: number): number {
  const integer = ratingX10FromStar(star);
  if (current === integer && integer < RATING_X10_MAX) {
    return integer + RATING_X10_STEP;
  }
  return integer;
}

export function ratingStarFill(ratingX10: number): { full: number; half: boolean } {
  return {
    full: Math.floor(ratingX10 / 10),
    half: ratingX10 % 10 === 5,
  };
}

export function isTastedOnAllowed(value: string, now: Date = new Date()): boolean {
  return parseCalendarDate(value) !== null && value <= tokyoToday(now);
}

export function normalizeNoteText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const ratingX10Schema = z
  .number({ error: TASTING_NOTE_MESSAGES.rating })
  .int({ error: TASTING_NOTE_MESSAGES.rating })
  .min(RATING_X10_MIN, { error: TASTING_NOTE_MESSAGES.rating })
  .max(RATING_X10_MAX, { error: TASTING_NOTE_MESSAGES.rating })
  .refine((value) => value % RATING_X10_STEP === 0, { error: TASTING_NOTE_MESSAGES.rating });

export const tastedOnSchema = z
  .string({ error: TASTING_NOTE_MESSAGES.tastedOnFormat })
  .refine((value) => parseCalendarDate(value) !== null, {
    error: TASTING_NOTE_MESSAGES.tastedOnFormat,
  })
  .refine((value) => parseCalendarDate(value) === null || isTastedOnAllowed(value), {
    error: TASTING_NOTE_MESSAGES.tastedOnFuture,
  });

export const noteDrinkNameSchema = z
  .string({ error: TASTING_NOTE_MESSAGES.drinkName })
  .trim()
  .min(1, { error: TASTING_NOTE_MESSAGES.drinkName })
  .max(NOTE_DRINK_NAME_MAX_LENGTH, { error: TASTING_NOTE_MESSAGES.drinkName });

export const noteTextSchema = z
  .string({ error: TASTING_NOTE_MESSAGES.noteText })
  .max(NOTE_TEXT_MAX_LENGTH, { error: TASTING_NOTE_MESSAGES.noteText });

const referenceId = z.string().uuid();

const photoIdsSchema = z
  .array(referenceId)
  .max(TASTING_NOTE_PHOTO_MAX, { error: TASTING_NOTE_MESSAGES.photoIdsMax })
  .refine((ids) => new Set(ids).size === ids.length, {
    error: TASTING_NOTE_MESSAGES.photoIdsDuplicate,
  });

function requireHandEntry(
  body: { bottleId?: string | null; drinkName?: string; drinkType?: unknown },
  context: z.RefinementCtx,
) {
  if (body.bottleId) {
    return;
  }
  if (!body.drinkName) {
    context.addIssue({
      code: "custom",
      path: ["drinkName"],
      message: TASTING_NOTE_MESSAGES.drinkName,
    });
  }
  if (!body.drinkType) {
    context.addIssue({
      code: "custom",
      path: ["drinkType"],
      message: TASTING_NOTE_MESSAGES.drinkType,
    });
  }
}

export const createTastingNoteSchema = z
  .object({
    bottleId: referenceId.nullable().optional(),
    drinkName: noteDrinkNameSchema.optional(),
    drinkType: drinkTypeSchema.optional(),
    vintage: vintageSchema.nullable().optional(),
    tastedOn: tastedOnSchema,
    appearance: noteTextSchema.nullable().optional(),
    aroma: noteTextSchema.nullable().optional(),
    taste: noteTextSchema.nullable().optional(),
    finish: noteTextSchema.nullable().optional(),
    ratingX10: ratingX10Schema,
    photoIds: photoIdsSchema.optional(),
  })
  .strict()
  .superRefine(requireHandEntry);

export type CreateTastingNoteInput = z.infer<typeof createTastingNoteSchema>;

export const updateTastingNoteSchema = z
  .object({
    bottleId: referenceId.nullable().optional(),
    drinkName: noteDrinkNameSchema.optional(),
    drinkType: drinkTypeSchema.optional(),
    vintage: vintageSchema.nullable().optional(),
    tastedOn: tastedOnSchema.optional(),
    appearance: noteTextSchema.nullable().optional(),
    aroma: noteTextSchema.nullable().optional(),
    taste: noteTextSchema.nullable().optional(),
    finish: noteTextSchema.nullable().optional(),
    ratingX10: ratingX10Schema.optional(),
    photoIds: photoIdsSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: TASTING_NOTE_MESSAGES.patchEmpty })
  .superRefine((body, context) => {
    if (body.bottleId === null) {
      requireHandEntry(body, context);
    }
  });

export type UpdateTastingNoteInput = z.infer<typeof updateTastingNoteSchema>;

const ratingBoundSchema = z.coerce
  .number({ error: TASTING_NOTE_MESSAGES.ratingRange })
  .int({ error: TASTING_NOTE_MESSAGES.ratingRange })
  .min(RATING_X10_MIN, { error: TASTING_NOTE_MESSAGES.ratingRange })
  .max(RATING_X10_MAX, { error: TASTING_NOTE_MESSAGES.ratingRange })
  .refine((value) => value % RATING_X10_STEP === 0, {
    error: TASTING_NOTE_MESSAGES.ratingRange,
  });

export const tastingNotesQuerySchema = z
  .object({
    bottleId: referenceId.optional(),
    q: z
      .string({ error: TASTING_NOTE_MESSAGES.q })
      .max(NOTE_SEARCH_MAX_LENGTH, { error: TASTING_NOTE_MESSAGES.q })
      .optional(),
    drinkType: drinkTypeSchema.optional(),
    ratingX10Min: ratingBoundSchema.optional(),
    ratingX10Max: ratingBoundSchema.optional(),
    limit: z.coerce
      .number({ error: TASTING_NOTE_MESSAGES.limit })
      .int({ error: TASTING_NOTE_MESSAGES.limit })
      .min(1, { error: TASTING_NOTE_MESSAGES.limit })
      .max(100, { error: TASTING_NOTE_MESSAGES.limit })
      .default(50),
    cursor: z
      .string({ error: TASTING_NOTE_MESSAGES.cursor })
      .min(1, { error: TASTING_NOTE_MESSAGES.cursor })
      .max(256, { error: TASTING_NOTE_MESSAGES.cursor })
      .optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (
      query.ratingX10Min !== undefined &&
      query.ratingX10Max !== undefined &&
      query.ratingX10Min > query.ratingX10Max
    ) {
      context.addIssue({
        code: "custom",
        path: ["ratingX10Min"],
        message: TASTING_NOTE_MESSAGES.ratingRange,
      });
    }
  });

export type TastingNotesQuery = z.infer<typeof tastingNotesQuerySchema>;

export const tastingNoteIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const tastingNoteBottleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.enum(BOTTLE_STATUSES),
  })
  .nullable();

export type TastingNoteBottle = z.infer<typeof tastingNoteBottleSchema>;

export const tastingNoteListItemSchema = z.object({
  id: z.string(),
  drinkName: z.string(),
  drinkType: drinkTypeSchema,
  vintage: z.number().int().nullable(),
  tastedOn: z.string(),
  ratingX10: z.number().int(),
  bottleId: z.string().nullable(),
  thumbPhotoId: z.string().nullable(),
  photoCount: z.number().int().min(0),
  taste: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TastingNoteListItem = z.infer<typeof tastingNoteListItemSchema>;

export const tastingNoteSchema = tastingNoteListItemSchema.extend({
  appearance: z.string().nullable(),
  aroma: z.string().nullable(),
  taste: z.string().nullable(),
  finish: z.string().nullable(),
  photos: z.array(photoMetaSchema),
  bottle: tastingNoteBottleSchema,
});

export type TastingNote = z.infer<typeof tastingNoteSchema>;

export const tastingNotesResponseSchema = z
  .object({
    items: z.array(tastingNoteListItemSchema),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().min(0),
  })
  .strict();

export type TastingNotesResponse = z.infer<typeof tastingNotesResponseSchema>;
