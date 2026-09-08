import { describe, expect, it } from "vitest";
import { parseNoteRecognizePayload, pickNoteRecognizeFields } from "./note-recognize.ts";

describe("pickNoteRecognizeFields", () => {
  it("壊れた JSON / 非オブジェクトは空 fields", () => {
    expect(pickNoteRecognizeFields(null)).toEqual({});
    expect(pickNoteRecognizeFields("not-json")).toEqual({});
  });

  it("範囲外・未知 enum は省き、正常な欄だけ残す", () => {
    expect(
      pickNoteRecognizeFields({
        drinkName: { value: "サンプル赤", confidence: 0.84 },
        drinkType: { value: "vodka", confidence: 0.9 },
        vintage: { value: 1200, confidence: 0.9 },
      }),
    ).toEqual({
      drinkName: { value: "サンプル赤", confidence: 0.84 },
    });
  });

  it("fields ラッパーと vintage の文字列を受け付ける", () => {
    expect(
      parseNoteRecognizePayload({
        response: '{"fields":{"vintage":{"value":"2019","confidence":0.8},"drinkType":{"value":"wine","confidence":0.9}}}',
      }),
    ).toEqual({
      vintage: { value: 2019, confidence: 0.8 },
      drinkType: { value: "wine", confidence: 0.9 },
    });
  });
});
