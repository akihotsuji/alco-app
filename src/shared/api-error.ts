import { z } from "zod";

/** `spec/api-design.md` 2.6 のエラーコード。クライアントはこの値だけを見る。 */
export const API_ERROR_CODES = [
  "validation_error",
  "unauthorized",
  "not_found",
  "payload_too_large",
  "unsupported_media_type",
  "rate_limited",
  "upstream_error",
  "internal_error",
] as const;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** `fields` のキーはリクエストのフィールド名（ネストは `.` 区切り）。ルート全体の不備は `""`。 */
export const apiErrorFieldsSchema = z.record(z.string(), z.array(z.string()));
export type ApiErrorFields = z.infer<typeof apiErrorFieldsSchema>;

export const apiErrorBodySchema = z.object({
  error: apiErrorCodeSchema,
  fields: apiErrorFieldsSchema.optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
