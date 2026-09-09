import { describe, expect, it } from "vitest";
import { extractModelPayload, pickRecognizeFields } from "./label-recognize.ts";

describe("pickRecognizeFields", () => {
  it("壊れた JSON / 非オブジェクトは空 fields", () => {
    expect(pickRecognizeFields(null)).toEqual({});
    expect(pickRecognizeFields("not-json")).toEqual({});
    expect(pickRecognizeFields(12)).toEqual({});
  });

  it("範囲外・未知 enum・長すぎる文字は省き、正常な欄だけ残す", () => {
    const fields = pickRecognizeFields({
      name: { value: "サンプル赤", confidence: 0.86 },
      producer: { value: "x".repeat(101), confidence: 0.9 },
      origin: { value: "フランス\u0000", confidence: 0.7 },
      variety: { value: "カベルネ", confidence: 0.8 },
      vintage: { value: 1200, confidence: 0.9 },
      drinkType: { value: "vodka", confidence: 0.9 },
      abvPercent: { value: 13.55, confidence: 0.4 },
      extra: { value: "no", confidence: 1 },
    });
    expect(fields).toEqual({
      name: { value: "サンプル赤", confidence: 0.86 },
      origin: { value: "フランス", confidence: 0.7 },
      variety: { value: "カベルネ", confidence: 0.8 },
      abvPercent: { value: 13.6, confidence: 0.4 },
    });
  });

  it("fields ラッパーと vintage の文字列を受け付ける", () => {
    const fields = pickRecognizeFields({
      fields: {
        vintage: { value: "2020", confidence: 0.9 },
        drinkType: { value: "wine", confidence: 0.95 },
      },
    });
    expect(fields).toEqual({
      vintage: { value: 2020, confidence: 0.9 },
      drinkType: { value: "wine", confidence: 0.95 },
    });
  });
});

describe("extractModelPayload", () => {
  it("markdown フェンスと response 文字列を剥がす", () => {
    expect(extractModelPayload('```json\n{"name":{"value":"赤","confidence":0.8}}\n```')).toEqual({
      name: { value: "赤", confidence: 0.8 },
    });
    expect(
      extractModelPayload({ response: 'prefix {"vintage":{"value":2020,"confidence":1}} suffix' }),
    ).toEqual({ vintage: { value: 2020, confidence: 1 } });
  });

  it("壊れた文字列は null", () => {
    expect(extractModelPayload("{not json")).toBeNull();
    expect(extractModelPayload({ response: "nope" })).toBeNull();
  });

  it("Chat Completions の choices[].message.content を剥がす", () => {
    expect(
      extractModelPayload({
        choices: [{ message: { content: '{"name":{"value":"赤","confidence":0.8}}' } }],
      }),
    ).toEqual({ name: { value: "赤", confidence: 0.8 } });
  });

  it("Generate Content の candidates[].content.parts を剥がす", () => {
    expect(
      extractModelPayload({
        candidates: [
          {
            content: {
              parts: [{ text: '{"name":{"value":"赤","confidence":0.8}}' }],
            },
          },
        ],
      }),
    ).toEqual({ name: { value: "赤", confidence: 0.8 } });
  });

  it("思考パートを捨て、最後の酒記録 JSON を取る", () => {
    expect(
      extractModelPayload({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { thought: true, text: 'scratch { "ignore": true }' },
                { text: 'prefix {"name":{"value":"赤","confidence":0.8}}' },
              ],
            },
          },
        ],
      }),
    ).toEqual({ name: { value: "赤", confidence: 0.8 } });
  });
});
