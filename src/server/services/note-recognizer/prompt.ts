import { DRINK_TYPES } from "@/shared/constants.ts";
import { IDENTITY_INFERENCE_PROMPT } from "../identity-inference-prompt.ts";

/** サーバー固定。ユーザー入力は含めない。ラベルまたはグラス写真から銘柄・種類・年を推測する */
export const NOTE_RECOGNIZE_SYSTEM_PROMPT = [
  "You estimate tasting-note fields from a photo of a drink, glass, can, or bottle label.",
  "Return JSON only. No markdown. No extra keys.",
  "Prefer printed label text. If a field is not fully readable, omit it.",
  "Do not guess typical brand, origin, or variety.",
  "Do not invent completely unrelated brands. Do not encourage drinking.",
  "Schema:",
  "{",
  '  "drinkName": { "value": string, "confidence": number },',
  '  "drinkType": { "value": string, "confidence": number },',
  '  "vintage": { "value": number, "confidence": number },',
  '  "producer": { "value": string, "confidence": number },',
  '  "origin": { "value": string, "confidence": number },',
  '  "variety": { "value": string, "confidence": number }',
  "}",
  `drinkType must be one of: ${DRINK_TYPES.join(", ")}.`,
  "Prefer a specific wine type from liquid color, bubbles, and bottle glass:",
  "wine_red=赤ワイン/red wine, wine_white=白ワイン/white wine, wine_rose=ロゼ/rosé,",
  "wine_sparkling=スパークリング/champagne/bubbles, wine_orange=オレンジワイン/amber.",
  "Use wine only when it is clearly wine but the color or style is unclear.",
  "beer=ビール/beer glass/pint/can, whisky=ウイスキー/rocks glass,",
  "sake=日本酒/ochoko/tokkuri, shochu=焼酎, cocktail=カクテル/cocktail glass, other=不明・その他.",
  "drinkName is the brand, cuvée, or recognizable drink name. Max 100 characters.",
  "producer is the winery/distillery/brewery.",
  IDENTITY_INFERENCE_PROMPT,
  "vintage is a 4-digit year from 1800 to 2100. Omit for NV / non-vintage / beer / cocktails without a year.",
  "confidence is 0 to 1.",
].join(" ");

export const NOTE_RECOGNIZE_USER_PROMPT =
  "Extract the drink name, type, vintage, producer, country of origin, and variety from this photo when evidence exists. Return the JSON object described in the system message.";

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

/** Gemini responseSchema（uppercase types）。Workers AI guided_json には使わない */
export const NOTE_RECOGNIZE_GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    drinkName: geminiTextProperty,
    drinkType: geminiTextProperty,
    vintage: geminiIntProperty,
    producer: geminiTextProperty,
    origin: geminiTextProperty,
    variety: geminiTextProperty,
  },
} as const;

export const NOTE_RECOGNIZE_GUIDED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    drinkName: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "string" },
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
    vintage: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "integer" },
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
  },
} as const;
