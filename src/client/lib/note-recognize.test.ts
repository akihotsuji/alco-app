import { describe, expect, it } from "vitest";
import { initialNoteFormState } from "./note-form.ts";
import { applyRecognizeToNoteForm } from "./note-recognize.ts";

const NOW = new Date("2026-09-08T03:00:00.000Z");

describe("applyRecognizeToNoteForm", () => {
  it("空欄にだけ入れ、確度 0.5 未満と触った欄は捨てる", () => {
    const result = applyRecognizeToNoteForm({
      state: { ...initialNoteFormState(NOW), drinkName: "手入力" },
      fields: {
        drinkName: { value: "AI名", confidence: 0.9 },
        drinkType: { value: "wine", confidence: 0.8 },
        vintage: { value: 2020, confidence: 0.49 },
      },
      touched: {
        drinkName: false,
        drinkType: false,
        vintage: false,
        producer: false,
        origin: false,
        variety: false,
      },
    });
    expect(result.next.drinkName).toBe("手入力");
    expect(result.next.drinkType).toBe("wine");
    expect(result.next.vintage).toBe("");
    expect(result.applied).toEqual(["drinkType"]);
  });

  it("識別 3 項目も空欄にだけ入れる", () => {
    const result = applyRecognizeToNoteForm({
      state: initialNoteFormState(NOW),
      fields: {
        producer: { value: "生産者", confidence: 0.8 },
        origin: { value: "フランス", confidence: 0.7 },
        variety: { value: "ピノ", confidence: 0.6 },
      },
      touched: {
        drinkName: false,
        drinkType: false,
        vintage: false,
        producer: false,
        origin: false,
        variety: false,
      },
    });
    expect(result.next).toMatchObject({
      producer: "生産者",
      origin: "フランス",
      variety: "ピノ",
    });
    expect(result.applied).toEqual(["producer", "origin", "variety"]);
  });

  it("ボトル選択中は種類を変えない", () => {
    const result = applyRecognizeToNoteForm({
      state: {
        ...initialNoteFormState(NOW),
        bottleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        drinkType: "beer",
      },
      fields: {
        drinkType: { value: "wine", confidence: 0.95 },
        vintage: { value: 2018, confidence: 0.8 },
      },
      touched: {
        drinkName: false,
        drinkType: false,
        vintage: false,
        producer: false,
        origin: false,
        variety: false,
      },
    });
    expect(result.next.drinkType).toBe("beer");
    expect(result.next.vintage).toBe("2018");
  });
});
