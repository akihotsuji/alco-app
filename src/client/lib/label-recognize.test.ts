import { describe, expect, it } from "vitest";
import { INITIAL_BOTTLE_FORM } from "./bottle-form.ts";
import { applyRecognizeToForm, countRecognizeFields } from "./label-recognize.ts";

describe("applyRecognizeToForm", () => {
  it("空欄にだけ入れ、確度 0.5 未満と度数は捨てる", () => {
    const result = applyRecognizeToForm({
      state: { ...INITIAL_BOTTLE_FORM, name: "手入力" },
      fields: {
        name: { value: "AI名", confidence: 0.9 },
        producer: { value: "生産者", confidence: 0.71 },
        origin: { value: "フランス", confidence: 0.49 },
        variety: { value: "カベルネ", confidence: 0.8 },
        vintage: { value: 2020, confidence: 0.9 },
        drinkType: { value: "whisky", confidence: 0.95 },
        abvPercent: { value: 13.5, confidence: 0.99 },
      },
      drinkTypeTouched: false,
      marks: new Set(),
    });
    expect(result.next.name).toBe("手入力");
    expect(result.next.producer).toBe("生産者");
    expect(result.next.origin).toBe("");
    expect(result.next.variety).toBe("カベルネ");
    expect(result.next.vintage).toBe("2020");
    expect(result.marks.has("variety")).toBe(true);
    expect(result.next.drinkType).toBe("whisky");
    expect(result.next.storedOn).toBe(INITIAL_BOTTLE_FORM.storedOn);
    expect(result.next.storage).toBe(INITIAL_BOTTLE_FORM.storage);
    expect(result.marks.has("name")).toBe(false);
    expect(result.marks.has("producer")).toBe(true);
    expect(result.marks.has("vintage")).toBe(true);
    expect(result.openDetails).toBe(true);
  });

  it("種類を触っていたら変えない。度数だけなら詳細を開かない", () => {
    const result = applyRecognizeToForm({
      state: INITIAL_BOTTLE_FORM,
      fields: {
        drinkType: { value: "beer", confidence: 0.9 },
        abvPercent: { value: 5, confidence: 0.9 },
      },
      drinkTypeTouched: true,
      marks: new Set(),
    });
    expect(result.next.drinkType).toBe("wine");
    expect(result.openDetails).toBe(false);
    expect(result.applied).toEqual([]);
  });

  it("再読取は AI 印の欄を上書きし、手入力は残す", () => {
    const first = applyRecognizeToForm({
      state: INITIAL_BOTTLE_FORM,
      fields: {
        name: { value: "一枚目", confidence: 0.9 },
        origin: { value: "フランス", confidence: 0.8 },
      },
      drinkTypeTouched: false,
      marks: new Set(),
    });
    const second = applyRecognizeToForm({
      state: { ...first.next, producer: "手入力" },
      fields: {
        name: { value: "二枚目", confidence: 0.9 },
        origin: { value: "イタリア", confidence: 0.8 },
        producer: { value: "AI生産者", confidence: 0.9 },
      },
      drinkTypeTouched: false,
      marks: first.marks,
    });
    expect(second.next.name).toBe("二枚目");
    expect(second.next.origin).toBe("イタリア");
    expect(second.next.producer).toBe("手入力");
    expect(second.marks.has("name")).toBe(true);
    expect(second.marks.has("producer")).toBe(false);
  });
});

describe("countRecognizeFields", () => {
  it("定義されたキーだけ数える", () => {
    expect(countRecognizeFields({})).toBe(0);
    expect(countRecognizeFields({ abvPercent: { value: 12, confidence: 0.3 } })).toBe(1);
  });
});
