import { z } from "zod";
import { DEFAULT_LABEL_RECOGNIZE_PROVIDER, LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";
import { recognizedDrinkTypeValueSchema } from "./drink-logs.ts";
import { pickIdentityRecognizeFields } from "./identity-recognize.ts";
import { extractModelPayload } from "./label-recognize.ts";

/**
 * `POST /api/tasting-notes/recognize` の契約。
 * 正本: spec/api-design.md 4.6 / spec/features/register-identity.md 6
 */

const confidenceSchema = z.number().min(0).max(1);

const drinkTypeCandidateSchema = z.object({
  value: recognizedDrinkTypeValueSchema,
  confidence: confidenceSchema,
});

export const noteRecognizeFieldKeys = [
  "drinkName",
  "drinkType",
  "vintage",
  "producer",
  "origin",
  "variety",
] as const;

export type NoteRecognizeFieldKey = (typeof noteRecognizeFieldKeys)[number];

export const noteRecognizeFieldsSchema = z
  .object({
    drinkName: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    drinkType: drinkTypeCandidateSchema.optional(),
    vintage: z.object({ value: z.number().int(), confidence: confidenceSchema }).optional(),
    producer: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    origin: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
    variety: z.object({ value: z.string(), confidence: confidenceSchema }).optional(),
  })
  .strict();

export type NoteRecognizeFields = z.infer<typeof noteRecognizeFieldsSchema>;

export const noteRecognizeResponseSchema = z
  .object({
    fields: noteRecognizeFieldsSchema,
    provider: z.enum(LABEL_RECOGNIZE_PROVIDERS),
    remainingToday: z.number().int().min(0),
  })
  .strict();

export type NoteRecognizeResponse = z.infer<typeof noteRecognizeResponseSchema>;

export const defaultNoteRecognizeProvider = DEFAULT_LABEL_RECOGNIZE_PROVIDER;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** モデル出力の 1 フィールド。検証に落ちたら省く（全体は失敗にしない） */
export function pickNoteRecognizeFields(raw: unknown): NoteRecognizeFields {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }
  const source = asRecord(record.fields) ?? record;
  const fields: NoteRecognizeFields = { ...pickIdentityRecognizeFields(source) };
  const drinkType = drinkTypeCandidateSchema.safeParse(source.drinkType);
  if (drinkType.success) {
    fields.drinkType = drinkType.data;
  }
  return fields;
}

export function parseNoteRecognizePayload(output: unknown): NoteRecognizeFields {
  return pickNoteRecognizeFields(extractModelPayload(output));
}
