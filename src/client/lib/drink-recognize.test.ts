import { describe, expect, it } from "vitest";
import { applyRecognizeToLogForm } from "./drink-recognize.ts";
import { initialLogFormState } from "./log-form.ts";

const NOW = new Date("2026-09-05T04:05:00.000Z");
const untouched = {
  drinkName: false,
  drinkType: false,
  volumeMl: false,
  abvPercent: false,
  producer: false,
  origin: false,
  variety: false,
  vintage: false,
};

describe("applyRecognizeToLogForm", () => {
  it("種類と量を先に選び、量チップに合う値ならその値のまま", () => {
    const state = initialLogFormState(null, NOW);
    const { next, applied } = applyRecognizeToLogForm({
      state,
      fields: {
        drinkType: { value: "beer", confidence: 0.8 },
        volumeMl: { value: 350, confidence: 0.7 },
        abvPercent: { value: 5, confidence: 0.6 },
      },
      touched: untouched,
    });
    expect(next.drinkType).toBe("beer");
    expect(next.volumeMl).toBe(350);
    expect(next.abvPercent).toBe(5);
    expect(applied).toEqual(["drinkType", "volumeMl", "abvPercent"]);
  });

  it("種類だけなら量・度数は種類のデフォルト。applyDrinkType 経由ではない", () => {
    const state = { ...initialLogFormState(null, NOW), volumeMl: 125, abvPercent: 12 };
    const { next } = applyRecognizeToLogForm({
      state,
      fields: { drinkType: { value: "beer", confidence: 0.9 } },
      touched: untouched,
    });
    expect(next).toMatchObject({ drinkType: "beer", volumeMl: 350, abvPercent: 5 });
  });

  it("量の推測を種類のデフォルトより優先する", () => {
    const { next } = applyRecognizeToLogForm({
      state: initialLogFormState(null, NOW),
      fields: {
        drinkType: { value: "beer", confidence: 0.9 },
        volumeMl: { value: 500, confidence: 0.8 },
      },
      touched: untouched,
    });
    expect(next.volumeMl).toBe(500);
    expect(next.abvPercent).toBe(5);
  });

  it("ユーザーが先に触った欄とボトル選択中の種類は変えない", () => {
    const state = {
      ...initialLogFormState(null, NOW),
      drinkType: "wine" as const,
      volumeMl: 150,
      bottleId: "11111111-1111-4111-8111-111111111111",
    };
    const { next, applied } = applyRecognizeToLogForm({
      state,
      fields: {
        drinkType: { value: "beer", confidence: 0.9 },
        volumeMl: { value: 350, confidence: 0.9 },
      },
      touched: { ...untouched, volumeMl: true },
    });
    expect(next.drinkType).toBe("wine");
    expect(next.volumeMl).toBe(150);
    expect(applied).toEqual([]);
  });

  it("確度 0.5 未満は捨てる", () => {
    const state = initialLogFormState(null, NOW);
    const { next, applied } = applyRecognizeToLogForm({
      state,
      fields: {
        drinkType: { value: "beer", confidence: 0.49 },
        volumeMl: { value: 350, confidence: 0.4 },
      },
      touched: untouched,
    });
    expect(next).toEqual(state);
    expect(applied).toEqual([]);
  });

  it("再読取は AI が入った識別を上書きし、手入力とボトル由来は残す", () => {
    const first = applyRecognizeToLogForm({
      state: initialLogFormState(null, NOW),
      fields: {
        drinkName: { value: "一枚目", confidence: 0.9 },
        origin: { value: "フランス", confidence: 0.8 },
        variety: { value: "ピノ", confidence: 0.7 },
      },
      touched: untouched,
    });
    expect(first.next).toMatchObject({
      drinkName: "一枚目",
      origin: "フランス",
      variety: "ピノ",
    });

    const second = applyRecognizeToLogForm({
      state: { ...first.next, producer: "手入力生産者", bottleId: null },
      fields: {
        drinkName: { value: "二枚目", confidence: 0.9 },
        origin: { value: "イタリア", confidence: 0.8 },
        variety: { value: "サンジョヴェーゼ", confidence: 0.7 },
        producer: { value: "AI生産者", confidence: 0.9 },
      },
      touched: { ...untouched, producer: true },
      marks: first.marks,
    });
    expect(second.next.drinkName).toBe("二枚目");
    expect(second.next.origin).toBe("イタリア");
    expect(second.next.variety).toBe("サンジョヴェーゼ");
    expect(second.next.producer).toBe("手入力生産者");
    expect(second.marks.has("drinkName")).toBe(true);

    const bottled = applyRecognizeToLogForm({
      state: {
        ...initialLogFormState(null, NOW),
        drinkName: "ボトル名",
        origin: "スペイン",
      },
      fields: {
        drinkName: { value: "AI名", confidence: 0.9 },
        origin: { value: "フランス", confidence: 0.9 },
      },
      touched: untouched,
      marks: new Set(),
    });
    expect(bottled.next.drinkName).toBe("ボトル名");
    expect(bottled.next.origin).toBe("スペイン");
  });
});
