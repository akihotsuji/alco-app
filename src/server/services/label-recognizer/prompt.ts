import { DRINK_TYPES } from "@/shared/constants.ts";

/** サーバー固定。ユーザー入力（銘柄名など）は含めない */
export const LABEL_RECOGNIZE_SYSTEM_PROMPT = [
  "You extract printed bottle-label fields from a photo of one alcoholic drink bottle.",
  "Return JSON only. No markdown. No extra keys.",
  "The image may be in Japanese or English (or both).",
  "Omit any field you cannot read from the label. Do not invent brands, years, or numbers.",
  "Schema:",
  "{",
  '  "name": { "value": string, "confidence": number },',
  '  "producer": { "value": string, "confidence": number },',
  '  "origin": { "value": string, "confidence": number },',
  '  "vintage": { "value": number, "confidence": number },',
  '  "drinkType": { "value": string, "confidence": number },',
  '  "abvPercent": { "value": number, "confidence": number }',
  "}",
  `drinkType must be one of: ${DRINK_TYPES.join(", ")}.`,
  "wine=ワイン, beer=ビール, whisky=ウイスキー/ウィスキー, sake=日本酒, shochu=焼酎, cocktail=カクテル, other=その他.",
  "vintage is a 4-digit year from 1800 to 2100. Omit for NV / non-vintage.",
  "abvPercent is 0-100 with at most one decimal.",
  "confidence is 0 to 1.",
  "name is the brand or cuvée on the label. producer is the winery/distillery. origin is region or country.",
].join(" ");

export const LABEL_RECOGNIZE_USER_PROMPT =
  "Read this bottle label and return the JSON object described in the system message.";

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
