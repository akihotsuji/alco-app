import { z } from "zod";
import { LABEL_RECOGNIZE_PROVIDERS } from "./constants.ts";

/**
 * 認識モデル設定と根拠区分。正本: spec/features/ai-recognition.md
 * クライアントからモデルや接続先は指定できない。
 */

export const AI_RECOGNITION_PROFILE_KEYS = ["gemini-3.7-flash", "workers-ai-llama"] as const;
export type AiRecognitionProfileKey = (typeof AI_RECOGNITION_PROFILE_KEYS)[number];
export const DEFAULT_AI_RECOGNITION_PROFILE: AiRecognitionProfileKey = "gemini-3.7-flash";
export const DEFAULT_LABEL_AI_RECOGNITION_PROFILE: AiRecognitionProfileKey = "workers-ai-llama";
export const DEFAULT_NOTE_AI_RECOGNITION_PROFILE: AiRecognitionProfileKey = "workers-ai-llama";

export const AI_RECOGNITION_TASKS = ["drink", "label", "note"] as const;
export type AiRecognitionTask = (typeof AI_RECOGNITION_TASKS)[number];

export const EVIDENCE_KINDS = [
  "label",
  "verified_origin",
  "product_source",
  "unverified_guess",
  "unknown",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const PHOTO_SUBJECTS = ["label", "glass", "can", "bottle", "mixed", "unknown"] as const;
export type PhotoSubject = (typeof PHOTO_SUBJECTS)[number];

export const DRINK_EXTRACT_PROMPT_VERSION = "drink-extract-v2";
export const DRINK_LOOKUP_PROMPT_VERSION = "drink-lookup-v1";
export const DRINK_OUTPUT_SCHEMA_VERSION = "drink-fields-v2";

export const unknownTokenUsage = {
  inputTokens: null,
  outputTokens: null,
  thinkingTokens: null,
  searchCount: null,
} as const;

export const tokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    thinkingTokens: z.number().int().nonnegative().nullable(),
    searchCount: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const recognizeSourceSchema = z
  .object({
    url: z.string().url().max(500),
    title: z.string().max(200).optional(),
    supports: z.array(z.enum(["origin", "variety"])).max(2).optional(),
  })
  .strict();

export type RecognizeSource = z.infer<typeof recognizeSourceSchema>;

export const recognizeRunMetaSchema = z
  .object({
    profile: z.string().min(1).max(80),
    provider: z.enum(LABEL_RECOGNIZE_PROVIDERS),
    modelId: z.string().min(1).max(120),
    durationMs: z.number().int().min(0),
    usage: tokenUsageSchema,
    sources: z.array(recognizeSourceSchema).max(8),
    searchUsed: z.boolean(),
  })
  .strict();

export type RecognizeRunMeta = z.infer<typeof recognizeRunMetaSchema>;

export function isAiRecognitionProfileKey(value: string): value is AiRecognitionProfileKey {
  return (AI_RECOGNITION_PROFILE_KEYS as readonly string[]).includes(value);
}

export function isEvidenceKind(value: string): value is EvidenceKind {
  return (EVIDENCE_KINDS as readonly string[]).includes(value);
}

export function isPhotoSubject(value: string): value is PhotoSubject {
  return (PHOTO_SUBJECTS as readonly string[]).includes(value);
}

/** 自動入力してよい根拠。confidence だけでは決めない */
export function canAutofillOrigin(kind: EvidenceKind): boolean {
  return kind === "label" || kind === "verified_origin" || kind === "product_source";
}

export function canAutofillVariety(kind: EvidenceKind): boolean {
  return kind === "label" || kind === "product_source";
}
