import { z } from "zod";
import { PHOTO_CONTENT_TYPES, PHOTO_KINDS } from "./constants.ts";

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().optional());

const optionalUuidOrNull = z.preprocess((value) => {
  if (value === "") {
    return null;
  }
  return value;
}, z.string().uuid().nullable().optional());

export const photoIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const photoUploadFieldsSchema = z
  .object({
    bottleId: optionalUuid,
    tastingNoteId: optionalUuid,
    drinkLogId: optionalUuid,
    sortOrder: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  })
  .strict()
  .superRefine((value, ctx) => {
    const owners = [value.bottleId, value.tastingNoteId, value.drinkLogId].filter(
      (id): id is string => typeof id === "string",
    );
    if (owners.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: [""],
        message: "紐付け先は1つまでにしてください",
      });
    }
  });

export const photoPatchSchema = z
  .object({
    bottleId: optionalUuidOrNull,
    tastingNoteId: optionalUuidOrNull,
    drinkLogId: optionalUuidOrNull,
    sortOrder: z.number().int().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const owners = [value.bottleId, value.tastingNoteId, value.drinkLogId].filter(
      (id): id is string => typeof id === "string",
    );
    if (owners.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: [""],
        message: "紐付け先は1つまでにしてください",
      });
    }
  });

export const photoMetaSchema = z.object({
  id: z.string(),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  byteSize: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  bottleId: z.string().nullable(),
  tastingNoteId: z.string().nullable(),
  drinkLogId: z.string().nullable(),
  kind: z.enum(PHOTO_KINDS),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PhotoUploadFields = z.infer<typeof photoUploadFieldsSchema>;
export type PhotoPatchInput = z.infer<typeof photoPatchSchema>;
export type PhotoMeta = z.infer<typeof photoMetaSchema>;
