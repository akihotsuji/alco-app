import { DRINK_TYPES } from "@/shared/constants.ts";

/** サーバー固定。ユーザー入力は含めない。ラベル OCR ではなく、グラス/缶/瓶の見た目から推測する */
export const DRINK_RECOGNIZE_SYSTEM_PROMPT = [
  "You estimate what alcoholic drink is in a photo of a glass, can, bottle, or cup.",
  "Return JSON only. No markdown. No extra keys.",
  "This is a rough guess. Prefer common serving sizes. Omit any field you cannot reasonably infer.",
  "Do not invent brand names. Do not encourage drinking.",
  "Schema:",
  "{",
  '  "drinkType": { "value": string, "confidence": number },',
  '  "volumeMl": { "value": number, "confidence": number },',
  '  "abvPercent": { "value": number, "confidence": number }',
  "}",
  `drinkType must be one of: ${DRINK_TYPES.join(", ")}.`,
  "wine=ワイン/wine glass/wine bottle, beer=ビール/beer glass/pint/can, whisky=ウイスキー/rocks glass,",
  "sake=日本酒/ochoko/tokkuri, shochu=焼酎, cocktail=カクテル/cocktail glass, other=不明・その他.",
  "volumeMl is an integer milliliters from 1 to 5000. Use typical pours:",
  "wine glass ~125, beer can ~350, pint ~500, whisky ~30, sake ~180, shochu ~60, cocktail ~120.",
  "abvPercent is 0-100 with at most one decimal. Use typical values if the container is clear.",
  "confidence is 0 to 1.",
].join(" ");

export const DRINK_RECOGNIZE_USER_PROMPT =
  "Guess the drink type and serving volume from this photo and return the JSON object described in the system message.";

export const DRINK_RECOGNIZE_GUIDED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
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
