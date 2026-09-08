import { z } from "zod";
import { IDENTITY_TEXT_MAX_LENGTH, VINTAGE_MAX, VINTAGE_MIN } from "./identity.ts";
import { stripControlChars } from "./label-recognize.ts";

const confidenceSchema = z.number().min(0).max(1);

function textCandidateSchema(max: number) {
  return z.object({
    value: z.string().transform(stripControlChars).pipe(z.string().min(1).max(max)),
    confidence: confidenceSchema,
  });
}

const vintageCandidateSchema = z.object({
  value: z.coerce.number().int().min(VINTAGE_MIN).max(VINTAGE_MAX),
  confidence: confidenceSchema,
});

export const identityRecognizeNameKeys = ["drinkName", "producer", "origin", "variety"] as const;

export type IdentityRecognizeFields = {
  drinkName?: { value: string; confidence: number };
  producer?: { value: string; confidence: number };
  origin?: { value: string; confidence: number };
  variety?: { value: string; confidence: number };
  vintage?: { value: number; confidence: number };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickText(
  source: Record<string, unknown>,
  keys: readonly string[],
): { value: string; confidence: number } | undefined {
  const schema = textCandidateSchema(IDENTITY_TEXT_MAX_LENGTH);
  for (const key of keys) {
    const parsed = schema.safeParse(source[key]);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return undefined;
}

/** モデル出力の識別欄。`name` / `drinkName` はどちらも品名として受け取る */
export function pickIdentityRecognizeFields(raw: unknown): IdentityRecognizeFields {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }
  const source = asRecord(record.fields) ?? record;
  const fields: IdentityRecognizeFields = {};
  const drinkName = pickText(source, ["drinkName", "name"]);
  if (drinkName) {
    fields.drinkName = drinkName;
  }
  const producer = pickText(source, ["producer"]);
  if (producer) {
    fields.producer = producer;
  }
  const origin = pickText(source, ["origin"]);
  if (origin) {
    fields.origin = origin;
  }
  const variety = pickText(source, ["variety"]);
  if (variety) {
    fields.variety = variety;
  }
  const vintage = vintageCandidateSchema.safeParse(source.vintage);
  if (vintage.success) {
    fields.vintage = vintage.data;
  }
  return fields;
}
