import { DRINK_TYPES } from "@/shared/constants.ts";
import { IDENTITY_INFERENCE_PROMPT } from "../identity-inference-prompt.ts";

/** サーバー固定。ユーザー入力（銘柄名など）は含めない */
export const LABEL_RECOGNIZE_SYSTEM_PROMPT = [
  "You extract bottle-label fields from a photo of one alcoholic drink bottle.",
  "Return JSON only. No markdown. No extra keys.",
  "The image may be in Japanese or English (or both).",
  "Prefer printed text on the label. If a field is not fully readable, omit it.",
  "Do not guess typical producer, region, vintage, or grape for the brand.",
  "Do not invent completely unrelated brands.",
  "Schema:",
  "{",
  '  "name": { "value": string, "confidence": number },',
  '  "producer": { "value": string, "confidence": number },',
  '  "origin": { "value": string, "confidence": number },',
  '  "variety": { "value": string, "confidence": number },',
  '  "vintage": { "value": number, "confidence": number },',
  '  "drinkType": { "value": string, "confidence": number },',
  '  "abvPercent": { "value": number, "confidence": number }',
  "}",
  `drinkType must be one of: ${DRINK_TYPES.join(", ")}.`,
  "Prefer a specific wine type from liquid color, foil, glass tint, and label words:",
  "wine_red=赤ワイン/red/rouge, wine_white=白ワイン/white/blanc, wine_rose=ロゼ/rosé/rose,",
  "wine_sparkling=スパークリング/champagne/cava/prosecco/crémant, wine_orange=オレンジワイン/amber/skin-contact.",
  "Use wine only when it is clearly wine but the color or style is unclear.",
  "beer=ビール, whisky=ウイスキー/ウィスキー, sake=日本酒, shochu=焼酎, cocktail=カクテル, other=その他.",
  "vintage is a 4-digit year from 1800 to 2100. Omit for NV / non-vintage.",
  "abvPercent is 0-100 with at most one decimal.",
  "confidence is 0 to 1.",
  "name is the brand or cuvée. producer is the winery/distillery.",
  IDENTITY_INFERENCE_PROMPT,
].join(" ");

export const LABEL_RECOGNIZE_USER_PROMPT =
  "Read this bottle and return the JSON object described in the system message. Omit fields without printed or verified evidence.";

/** 表 + 裏の 2 枚を渡すときの user プロンプト。画像の順序（1 枚目 = 表、2 枚目 = 裏）を明示する。 */
export const LABEL_RECOGNIZE_TWO_SIDED_USER_PROMPT =
  "Two photos of the same bottle: the first is the front label, the second is the back label. Combine printed text from both (the back label often states producer, origin, grape variety, vintage, and ABV) and return one JSON object described in the system message. Omit fields without printed or verified evidence.";

const geminiTextProperty = {
  type: "OBJECT",
  properties: {
    value: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
};

const geminiIntProperty = {
  type: "OBJECT",
  properties: {
    value: { type: "INTEGER" },
    confidence: { type: "NUMBER" },
  },
};

const geminiNumberProperty = {
  type: "OBJECT",
  properties: {
    value: { type: "NUMBER" },
    confidence: { type: "NUMBER" },
  },
};

/** Gemini responseSchema（uppercase types）。Workers AI guided_json には使わない */
export const LABEL_RECOGNIZE_GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: geminiTextProperty,
    producer: geminiTextProperty,
    origin: geminiTextProperty,
    variety: geminiTextProperty,
    vintage: geminiIntProperty,
    drinkType: geminiTextProperty,
    abvPercent: geminiNumberProperty,
  },
} as const;

export const LABEL_RECOGNIZE_GUIDED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    producer: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    origin: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    variety: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    vintage: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "integer" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    drinkType: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string", enum: [...DRINK_TYPES] },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
    abvPercent: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "number" },
        confidence: { type: "number" },
      },
      required: ["value", "confidence"],
    },
  },
} as const;
