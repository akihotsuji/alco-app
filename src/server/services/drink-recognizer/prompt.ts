import { DRINK_TYPES } from "@/shared/constants.ts";

/** サーバー固定。ユーザー入力は含めない。ラベル OCR ではなく、グラス/缶/瓶の見た目から推測する */
export const DRINK_RECOGNIZE_SYSTEM_PROMPT = [
  "You estimate what alcoholic drink is in a photo of a glass, can, bottle, or cup.",
  "Return JSON only. No markdown. No extra keys.",
  "This is a rough guess. Prefer common serving sizes. Omit any field you cannot reasonably infer.",
  "Prefer printed label text for identity fields. If a field is not fully readable, infer a likely value.",
  "Do not invent completely unrelated brands. Do not encourage drinking.",
  "Schema:",
  "{",
  '  "drinkName": { "value": string, "confidence": number },',
  '  "producer": { "value": string, "confidence": number },',
  '  "origin": { "value": string, "confidence": number },',
  '  "variety": { "value": string, "confidence": number },',
  '  "vintage": { "value": number, "confidence": number },',
  '  "drinkType": { "value": string, "confidence": number },',
  '  "volumeMl": { "value": number, "confidence": number },',
  '  "abvPercent": { "value": number, "confidence": number }',
  "}",
  `drinkType must be one of: ${DRINK_TYPES.join(", ")}.`,
  "wine=ワイン/wine glass/wine bottle, beer=ビール/beer glass/pint/can, whisky=ウイスキー/rocks glass,",
  "sake=日本酒/ochoko/tokkuri, shochu=焼酎, cocktail=カクテル/cocktail glass, other=不明・その他.",
  "volumeMl is an integer milliliters from 1 to 5000. Use typical pours:",
  "wine glass ~125, beer can ~350, pint ~500, whisky ~30, sake ~180, shochu ~60, cocktail ~120.",
  "drinkName is the brand, cuvée, or recognizable drink name. Max 100 characters.",
  "producer is the winery/distillery/brewery. origin is the country of production (e.g. フランス, Japan), not a small appellation when both appear.",
  "variety is grape, rice, hop, or malt variety. vintage is a 4-digit year from 1800 to 2100. Omit for NV.",
  "abvPercent is 0-100 with at most one decimal. Use typical values if the container is clear.",
  "confidence is 0 to 1.",
].join(" ");

export const DRINK_RECOGNIZE_USER_PROMPT =
  "Guess the drink identity, type, and serving volume from this photo and return the JSON object described in the system message.";

export const DRINK_RECOGNIZE_GUIDED_JSON_SCHEMA = {
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
    volumeMl: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: "integer" },
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
