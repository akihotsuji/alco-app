import { z } from "zod";
import { recognizeRunMetaSchema } from "./ai-recognition.ts";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN, VOLUME_ML_MAX, VOLUME_ML_MIN } from "./alcohol.ts";
import { DEFAULT_LABEL_RECOGNIZE_PROVIDER, LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";
import { recognizedDrinkTypeValueSchema } from "./drink-logs.ts";
import { pickIdentityRecognizeFields } from "./identity-recognize.ts";
import { extractModelPayload } from "./label-recognize.ts";

/**
 * `POST /api/drink-logs/recognize` の契約。
 * 正本: spec/api-design.md 4.3 / spec/features/register-identity.md 6
 */

const confidenceSchema = z.number().min(0).max(1);

function roundAbv(value: number): number {
  return Math.round(value * 10) / 10;
}

const drinkTypeCandidateSchema = z.object({
  value: recognizedDrinkTypeValueSchema,
  confidence: confidenceSchema,
});

const volumeCandidateSchema = z.object({
  value: z.coerce
    .number()
    .transform((value) => Math.round(value))
    .pipe(z.number().int().min(VOLUME_ML_MIN).max(VOLUME_ML_MAX)),
  confidence: confidenceSchema,
});

const abvCandidateSchema = z.object({
  value: z.coerce.number().min(ABV_PERCENT_MIN).max(ABV_PERCENT_MAX).transform(roundAbv),
  confidence: confidenceSchema,
});

export const drinkRecognizeFieldKeys = [
  "drinkName",
  "producer",
  "origin",
  "variety",
  "vintage",
  "drinkType",
  "volumeMl",
  "abvPercent",
] as const;

export type DrinkRecognizeFieldKey = (typeof drinkRecognizeFieldKeys)[number];

export const drinkRecognizeFieldsSchema = z
  .object({
    drinkName: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    producer: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    origin: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    variety: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    vintage: z.object({ value: z.number().int(), confidence: confidenceSchema }).optional(),
    drinkType: drinkTypeCandidateSchema.optional(),
    volumeMl: volumeCandidateSchema.optional(),
    abvPercent: abvCandidateSchema.optional(),
  })
  .strict();

export type DrinkRecognizeFields = z.infer<typeof drinkRecognizeFieldsSchema>;

export const drinkRecognizeResponseSchema = z
  .object({
    fields: drinkRecognizeFieldsSchema,
    provider: z.enum(LABEL_RECOGNIZE_PROVIDERS),
    remainingToday: z.number().int().min(0),
    profile: recognizeRunMetaSchema.shape.profile,
    modelId: recognizeRunMetaSchema.shape.modelId,
    durationMs: recognizeRunMetaSchema.shape.durationMs,
    usage: recognizeRunMetaSchema.shape.usage,
    sources: recognizeRunMetaSchema.shape.sources,
    searchUsed: recognizeRunMetaSchema.shape.searchUsed,
  })
  .strict();

export type DrinkRecognizeResponse = z.infer<typeof drinkRecognizeResponseSchema>;

export const defaultDrinkRecognizeProvider = DEFAULT_LABEL_RECOGNIZE_PROVIDER;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** モデル出力の 1 フィールド。検証に落ちたら省く（全体は失敗にしない） */
export function pickDrinkRecognizeFields(raw: unknown): DrinkRecognizeFields {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }
  const source = asRecord(record.fields) ?? record;
  const fields: DrinkRecognizeFields = { ...pickIdentityRecognizeFields(source) };
  const drinkType = drinkTypeCandidateSchema.safeParse(source.drinkType);
  if (drinkType.success) {
    fields.drinkType = drinkType.data;
  }
  const volumeMl = volumeCandidateSchema.safeParse(source.volumeMl);
  if (volumeMl.success) {
    fields.volumeMl = volumeMl.data;
  }
  const abvPercent = abvCandidateSchema.safeParse(source.abvPercent);
  if (abvPercent.success) {
    fields.abvPercent = abvPercent.data;
  }
  return fields;
}

export function parseDrinkRecognizePayload(output: unknown): DrinkRecognizeFields {
  return pickDrinkRecognizeFields(extractModelPayload(output));
}
