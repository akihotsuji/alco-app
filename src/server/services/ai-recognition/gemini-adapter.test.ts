import { describe, expect, it } from "vitest";
import { buildGeminiBody } from "./gemini-adapter.ts";
import { MODEL_PROFILES } from "./profiles.ts";

const profile = MODEL_PROFILES["gemini-3.7-flash"];

describe("buildGeminiBody", () => {
  it("画像抽出は Generate Content + inlineData + responseSchema", () => {
    const schema = { type: "OBJECT", properties: { drinkName: { type: "STRING" } } };
    const body = buildGeminiBody({
      profile,
      jpegBytes: new Uint8Array([1, 2, 3, 4]),
      systemPrompt: "sys",
      userPrompt: "user",
      schema,
      search: false,
      kind: "extract",
    });
    expect(body.messages).toBeUndefined();
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [{ inlineData: { mimeType: "image/jpeg", data: "AQIDBA==" } }, { text: "user" }],
      },
    ]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "sys" }] });
    expect(body.generationConfig).toEqual({
      temperature: 0,
      maxOutputTokens: profile.maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  it("検索照合は googleSearch を付け、画像は送らない", () => {
    const body = buildGeminiBody({
      profile,
      systemPrompt: "sys",
      userPrompt: "lookup",
      search: true,
      kind: "lookup",
    });
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    expect(body.generationConfig).toEqual({
      temperature: 0,
      maxOutputTokens: profile.lookupMaxOutputTokens,
      thinkingConfig: { thinkingLevel: "low" },
    });
    const parts = (body.contents as Array<{ parts: unknown[] }>)[0]?.parts;
    expect(parts).toEqual([{ text: "lookup" }]);
  });
});
