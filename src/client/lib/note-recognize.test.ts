import { describe, expect, it } from "vitest";
import { applyRecognizeToNoteForm } from "./note-recognize.ts";
import { initialNoteFormState } from "./note-form.ts";

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
      touched: { drinkName: false, drinkType: false, vintage: false },
    });
    expect(result.next.drinkName).toBe("手入力");
    expect(result.next.drinkType).toBe("wine");
    expect(result.next.vintage).toBe("");
    expect(result.applied).toEqual(["drinkType"]);
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
      touched: { drinkName: false, drinkType: false, vintage: false },
    });
    expect(result.next.drinkType).toBe("beer");
    expect(result.next.vintage).toBe("2018");
  });
});
