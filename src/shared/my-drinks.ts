import { z } from "zod";
import {
  abvPercentSchema,
  drinkTypeSchema,
  drunkAtSchema,
  memoSchema,
  volumeMlSchema,
} from "./drink-logs.ts";

export const MY_DRINK_MAX_COUNT = 30;
export const MY_DRINK_NAME_MAX_LENGTH = 40;

export const MY_DRINK_MESSAGES = {
  name: `1文字以上${MY_DRINK_NAME_MAX_LENGTH}文字以内で入力してください`,
  sortOrder: "並び順が正しくありません",
  count: `上限は${MY_DRINK_MAX_COUNT}件です`,
  patchEmpty: "変更する項目を指定してください",
  limit: "件数は1以上100以下で指定してください",
  cursor: "ページ情報が正しくありません",
} as const;

export const myDrinkNameSchema = z
  .string({ error: MY_DRINK_MESSAGES.name })
  .trim()
  .min(1, { error: MY_DRINK_MESSAGES.name })
  .max(MY_DRINK_NAME_MAX_LENGTH, { error: MY_DRINK_MESSAGES.name });

export const myDrinkSortOrderSchema = z
  .number({ error: MY_DRINK_MESSAGES.sortOrder })
  .int({ error: MY_DRINK_MESSAGES.sortOrder })
  .min(0, { error: MY_DRINK_MESSAGES.sortOrder });

const myDrinkFields = {
  name: myDrinkNameSchema,
  drinkType: drinkTypeSchema,
  volumeMl: volumeMlSchema,
  abvPercent: abvPercentSchema,
  sortOrder: myDrinkSortOrderSchema,
};

export const createMyDrinkSchema = z
  .object({
    name: myDrinkFields.name,
    drinkType: myDrinkFields.drinkType,
    volumeMl: myDrinkFields.volumeMl,
    abvPercent: myDrinkFields.abvPercent,
    sortOrder: myDrinkFields.sortOrder.optional(),
  })
  .strict();
export type CreateMyDrinkInput = z.infer<typeof createMyDrinkSchema>;

export const updateMyDrinkSchema = z
  .object({
    name: myDrinkFields.name.optional(),
    drinkType: myDrinkFields.drinkType.optional(),
    volumeMl: myDrinkFields.volumeMl.optional(),
    abvPercent: myDrinkFields.abvPercent.optional(),
    sortOrder: myDrinkFields.sortOrder.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: MY_DRINK_MESSAGES.patchEmpty });
export type UpdateMyDrinkInput = z.infer<typeof updateMyDrinkSchema>;

export const myDrinkIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const oneTapDrinkLogSchema = z
  .object({
    drunkAt: drunkAtSchema.optional(),
    memo: memoSchema.nullable().optional(),
  })
  .strict();
export type OneTapDrinkLogInput = z.infer<typeof oneTapDrinkLogSchema>;

export const myDrinksQuerySchema = z
  .object({
    limit: z.coerce
      .number({ error: MY_DRINK_MESSAGES.limit })
      .int({ error: MY_DRINK_MESSAGES.limit })
      .min(1, { error: MY_DRINK_MESSAGES.limit })
      .max(100, { error: MY_DRINK_MESSAGES.limit })
      .default(50),
    cursor: z
      .string({ error: MY_DRINK_MESSAGES.cursor })
      .min(1, { error: MY_DRINK_MESSAGES.cursor })
      .max(256, { error: MY_DRINK_MESSAGES.cursor })
      .optional(),
  })
  .strict();
export type MyDrinksQuery = z.infer<typeof myDrinksQuerySchema>;

export const myDrinkSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    drinkType: drinkTypeSchema,
    volumeMl: z.number().int(),
    abvPercent: z.number(),
    sortOrder: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type MyDrink = z.infer<typeof myDrinkSchema>;

export const myDrinksResponseSchema = z
  .object({
    items: z.array(myDrinkSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
export type MyDrinksResponse = z.infer<typeof myDrinksResponseSchema>;

export const deleteMyDrinkResponseSchema = z.object({ ok: z.literal(true) }).strict();
export type DeleteMyDrinkResponse = z.infer<typeof deleteMyDrinkResponseSchema>;
