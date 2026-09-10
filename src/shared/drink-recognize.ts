import { z } from "zod";
import { EVIDENCE_KINDS, recognizeRunMetaSchema } from "./ai-recognition.ts";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN, VOLUME_ML_MAX, VOLUME_ML_MIN } from "./alcohol.ts";
import { DEFAULT_LABEL_RECOGNIZE_PROVIDER, LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";
import { drinkTypeSchema, recognizedDrinkTypeValueSchema } from "./drink-logs.ts";
import { IDENTITY_TEXT_MAX_LENGTH } from "./identity.ts";
import { pickIdentityRecognizeFields } from "./identity-recognize.ts";
import { extractModelPayload } from "./label-recognize.ts";

/**
 * `POST /api/drink-logs/recognize`（抽出）と `POST /api/drink-logs/recognize/lookup`（照合）の契約。
 * 正本: spec/api-design.md 4.3 / spec/features/ai-recognition.md 6a・7a / spec/features/register-identity.md 6
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

/** 自動入力しない国の候補（根拠 unverified_guess。クライアントはチップで提示する） */
export const originCandidateSchema = z
  .object({
    value: z.string().min(1).max(IDENTITY_TEXT_MAX_LENGTH),
    evidence: z.enum(EVIDENCE_KINDS),
  })
  .strict();

export type OriginCandidate = z.infer<typeof originCandidateSchema>;

const runMetaShape = {
  provider: z.enum(LABEL_RECOGNIZE_PROVIDERS),
  remainingToday: z.number().int().min(0),
  profile: recognizeRunMetaSchema.shape.profile,
  modelId: recognizeRunMetaSchema.shape.modelId,
  durationMs: recognizeRunMetaSchema.shape.durationMs,
  usage: recognizeRunMetaSchema.shape.usage,
  sources: recognizeRunMetaSchema.shape.sources,
  searchUsed: recognizeRunMetaSchema.shape.searchUsed,
};

export const drinkRecognizeResponseSchema = z
  .object({
    fields: drinkRecognizeFieldsSchema,
    ...runMetaShape,
    /** 照合（二段階の後半）を勧めるか。true のときだけクライアントは lookup を 1 回呼ぶ */
    lookupSuggested: z.boolean(),
    originCandidate: originCandidateSchema.optional(),
    /** ラベルの産地表記。照合リクエストに渡すためだけに返す */
    appellation: z.string().max(IDENTITY_TEXT_MAX_LENGTH).optional(),
  })
  .strict();

export type DrinkRecognizeResponse = z.infer<typeof drinkRecognizeResponseSchema>;

const lookupTextSchema = z.string().trim().min(1).max(IDENTITY_TEXT_MAX_LENGTH);

/** 照合の入力。抽出結果の受け渡しなので長さだけ制限し、プロンプトでは識別対象データとして扱う */
export const drinkLookupRequestSchema = z
  .object({
    drinkName: lookupTextSchema,
    producer: lookupTextSchema,
    vintage: z.number().int().min(1800).max(2100).optional(),
    drinkType: drinkTypeSchema.optional(),
    appellation: z.string().trim().max(IDENTITY_TEXT_MAX_LENGTH).optional(),
  })
  .strict();

export type DrinkLookupRequest = z.infer<typeof drinkLookupRequestSchema>;

export const drinkLookupFieldsSchema = drinkRecognizeFieldsSchema.pick({
  origin: true,
  variety: true,
});

export type DrinkLookupFields = z.infer<typeof drinkLookupFieldsSchema>;

export const drinkLookupResponseSchema = z
  .object({
    fields: drinkLookupFieldsSchema,
    matched: z.boolean(),
    ...runMetaShape,
  })
  .strict();

export type DrinkLookupResponse = z.infer<typeof drinkLookupResponseSchema>;

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
