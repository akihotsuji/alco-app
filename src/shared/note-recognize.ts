import { z } from "zod";
import {
  BOTTLE_VINTAGE_MAX,
  BOTTLE_VINTAGE_MIN,
} from "./bottles.ts";
import { NOTE_DRINK_NAME_MAX_LENGTH } from "./tasting-notes.ts";
import { DEFAULT_LABEL_RECOGNIZE_PROVIDER, LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";
import { drinkTypeSchema } from "./drink-logs.ts";
import { extractModelPayload, stripControlChars } from "./label-recognize.ts";

/**
 * `POST /api/tasting-notes/recognize` の契約。
 * 正本: spec/api-design.md 4.6 / spec/features/tasting-note.md
 */

const confidenceSchema = z.number().min(0).max(1);

const drinkNameCandidateSchema = z.object({
  value: z.string().transform(stripControlChars).pipe(z.string().min(1).max(NOTE_DRINK_NAME_MAX_LENGTH)),
  confidence: confidenceSchema,
});

const drinkTypeCandidateSchema = z.object({
  value: drinkTypeSchema,
  confidence: confidenceSchema,
});

const vintageCandidateSchema = z.object({
  value: z.coerce.number().int().min(BOTTLE_VINTAGE_MIN).max(BOTTLE_VINTAGE_MAX),
  confidence: confidenceSchema,
});

export const noteRecognizeFieldKeys = ["drinkName", "drinkType", "vintage"] as const;

export type NoteRecognizeFieldKey = (typeof noteRecognizeFieldKeys)[number];

export const noteRecognizeFieldsSchema = z
  .object({
    drinkName: drinkNameCandidateSchema.optional(),
    drinkType: drinkTypeCandidateSchema.optional(),
    vintage: vintageCandidateSchema.optional(),
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
  const fields: NoteRecognizeFields = {};
  const drinkName = drinkNameCandidateSchema.safeParse(source.drinkName);
  if (drinkName.success) {
    fields.drinkName = drinkName.data;
  }
  const drinkType = drinkTypeCandidateSchema.safeParse(source.drinkType);
  if (drinkType.success) {
    fields.drinkType = drinkType.data;
  }
  const vintage = vintageCandidateSchema.safeParse(source.vintage);
  if (vintage.success) {
    fields.vintage = vintage.data;
  }
  return fields;
}

export function parseNoteRecognizePayload(output: unknown): NoteRecognizeFields {
  return pickNoteRecognizeFields(extractModelPayload(output));
}
