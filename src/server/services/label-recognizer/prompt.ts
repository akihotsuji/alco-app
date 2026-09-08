import { DRINK_TYPES } from "@/shared/constants.ts";

/** サーバー固定。ユーザー入力（銘柄名など）は含めない */
export const LABEL_RECOGNIZE_SYSTEM_PROMPT = [
  "You extract bottle-label fields from a photo of one alcoholic drink bottle.",
  "Return JSON only. No markdown. No extra keys.",
  "The image may be in Japanese or English (or both).",
  "Prefer printed text on the label. If a field is not fully readable, you may infer a likely value from the bottle, foil, language, and typical producer/region/vintage/grape for that brand.",
  "Use lower confidence for inferred values. Omit a field only when you have no reasonable guess.",
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
  "wine=ワイン, beer=ビール, whisky=ウイスキー/ウィスキー, sake=日本酒, shochu=焼酎, cocktail=カクテル, other=その他.",
  "variety is grape, rice, hop, or malt variety (e.g. Cabernet Sauvignon, 山田錦). Omit if unknown.",
  "vintage is a 4-digit year from 1800 to 2100. Omit for NV / non-vintage.",
  "abvPercent is 0-100 with at most one decimal.",
  "confidence is 0 to 1.",
  "name is the brand or cuvée. producer is the winery/distillery. origin is the country of production (e.g. フランス, Japan), not a small appellation when both appear.",
].join(" ");

export const LABEL_RECOGNIZE_USER_PROMPT =
  "Read this bottle and return the JSON object described in the system message. Include inferred vintage, variety, and producer when you can reasonably guess.";

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
