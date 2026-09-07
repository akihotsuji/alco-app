import { z } from "zod";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN } from "./alcohol.ts";
import {
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  BOTTLE_VINTAGE_MAX,
  BOTTLE_VINTAGE_MIN,
} from "./bottles.ts";
import { DEFAULT_LABEL_RECOGNIZE_PROVIDER, LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";
import { drinkTypeSchema } from "./drink-logs.ts";

/**
 * `POST /api/bottles/recognize` の契約。
 * 正本: spec/api-design.md 4.5.3 / spec/features/cellar.md 4.5
 */

export function stripControlChars(value: string): string {
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      continue;
    }
    cleaned += char;
  }
  return cleaned.trim();
}

function roundAbv(value: number): number {
  return Math.round(value * 10) / 10;
}

const confidenceSchema = z.number().min(0).max(1);

function textCandidateSchema(max: number) {
  return z.object({
    value: z.string().transform(stripControlChars).pipe(z.string().min(1).max(max)),
    confidence: confidenceSchema,
  });
}

const vintageCandidateSchema = z.object({
  value: z.coerce.number().int().min(BOTTLE_VINTAGE_MIN).max(BOTTLE_VINTAGE_MAX),
  confidence: confidenceSchema,
});

const drinkTypeCandidateSchema = z.object({
  value: drinkTypeSchema,
  confidence: confidenceSchema,
});

const abvCandidateSchema = z.object({
  value: z.coerce.number().min(ABV_PERCENT_MIN).max(ABV_PERCENT_MAX).transform(roundAbv),
  confidence: confidenceSchema,
});

export const recognizeFieldKeys = [
  "name",
  "producer",
  "origin",
  "vintage",
  "drinkType",
  "abvPercent",
] as const;

export type RecognizeFieldKey = (typeof recognizeFieldKeys)[number];

export const recognizeFieldsSchema = z
  .object({
    name: textCandidateSchema(BOTTLE_NAME_MAX_LENGTH).optional(),
    producer: textCandidateSchema(BOTTLE_TEXT_MAX_LENGTH).optional(),
    origin: textCandidateSchema(BOTTLE_TEXT_MAX_LENGTH).optional(),
    vintage: vintageCandidateSchema.optional(),
    drinkType: drinkTypeCandidateSchema.optional(),
    abvPercent: abvCandidateSchema.optional(),
  })
  .strict();

export type RecognizeFields = z.infer<typeof recognizeFieldsSchema>;

export const labelRecognizeProviderSchema = z.enum(LABEL_RECOGNIZE_PROVIDERS);

export const recognizeResponseSchema = z
  .object({
    fields: recognizeFieldsSchema,
    provider: labelRecognizeProviderSchema,
    remainingToday: z.number().int().min(0),
  })
  .strict();

export type RecognizeResponse = z.infer<typeof recognizeResponseSchema>;

export const defaultRecognizeProvider = DEFAULT_LABEL_RECOGNIZE_PROVIDER;

/** モデル出力の 1 フィールド。検証に落ちたら省く（全体は失敗にしない） */
export function pickRecognizeFields(raw: unknown): RecognizeFields {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }
  const source = asRecord(record.fields) ?? record;
  const fields: RecognizeFields = {};
  const name = textCandidateSchema(BOTTLE_NAME_MAX_LENGTH).safeParse(source.name);
  if (name.success) {
    fields.name = name.data;
  }
  const producer = textCandidateSchema(BOTTLE_TEXT_MAX_LENGTH).safeParse(source.producer);
  if (producer.success) {
    fields.producer = producer.data;
  }
  const origin = textCandidateSchema(BOTTLE_TEXT_MAX_LENGTH).safeParse(source.origin);
  if (origin.success) {
    fields.origin = origin.data;
  }
  const vintage = vintageCandidateSchema.safeParse(source.vintage);
  if (vintage.success) {
    fields.vintage = vintage.data;
  }
  const drinkType = drinkTypeCandidateSchema.safeParse(source.drinkType);
  if (drinkType.success) {
    fields.drinkType = drinkType.data;
  }
  const abvPercent = abvCandidateSchema.safeParse(source.abvPercent);
  if (abvPercent.success) {
    fields.abvPercent = abvPercent.data;
  }
  return fields;
}

export function extractModelPayload(output: unknown): unknown {
  if (typeof output === "string") {
    return parseJsonText(output);
  }
  const record = asRecord(output);
  if (!record) {
    return output;
  }
  if (typeof record.response === "string") {
    return parseJsonText(record.response);
  }
  if (isRecord(record.response)) {
    return record.response;
  }
  const result = asRecord(record.result);
  if (result) {
    if (typeof result.response === "string") {
      return parseJsonText(result.response);
    }
    if (isRecord(result.response)) {
      return result.response;
    }
  }
  return record;
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
