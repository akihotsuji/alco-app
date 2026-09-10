import { describe, expect, it } from "vitest";
import {
  applyRecognizeToLogForm,
  DRINK_LOOKUP_FIELDS,
  DRINK_RECOGNIZE_BANNER,
  drinkRecognizeBannerMessage,
  lockInheritedRecognizeFields,
  pendingDrinkRecognizeFields,
  planDrinkLookup,
  settledRecognizeStatus,
} from "./drink-recognize.ts";
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

  it("ボトルから埋まった欄を触った扱いにする", () => {
    const touched = { ...untouched };
    lockInheritedRecognizeFields(
      touched,
      {
        ...initialLogFormState(null, NOW),
        drinkName: "ボトル名",
        origin: "イタリア",
        bottleId: "11111111-1111-4111-8111-111111111111",
      },
      { lockDrinkType: true },
    );
    expect(touched.drinkName).toBe(true);
    expect(touched.origin).toBe(true);
    expect(touched.drinkType).toBe(true);
    expect(touched.variety).toBe(false);
  });

  it("種類を AI が選んだら drinkType にも AI 印を付ける（行ピルで反映済みを示す）", () => {
    const { marks } = applyRecognizeToLogForm({
      state: initialLogFormState(null, NOW),
      fields: { drinkType: { value: "beer", confidence: 0.8 } },
      touched: untouched,
    });
    expect(marks.has("drinkType")).toBe(true);
    const locked = applyRecognizeToLogForm({
      state: initialLogFormState(null, NOW),
      fields: { drinkType: { value: "beer", confidence: 0.8 } },
      touched: { ...untouched, drinkType: true },
    });
    expect(locked.marks.has("drinkType")).toBe(false);
  });
});

describe("pendingDrinkRecognizeFields", () => {
  it("空欄と直前の AI 値の欄だけ「読み取り中」。触った欄・ボトル由来の値は含めない", () => {
    const state = {
      ...initialLogFormState(null, NOW),
      drinkName: "",
      producer: "AI生産者",
      origin: "スペイン",
      variety: "",
      vintage: "2019",
    };
    const pending = pendingDrinkRecognizeFields(
      state,
      { ...untouched, variety: true },
      new Set(["producer"]),
    );
    expect(pending.has("drinkName")).toBe(true);
    expect(pending.has("producer")).toBe(true);
    expect(pending.has("origin")).toBe(false);
    expect(pending.has("variety")).toBe(false);
    expect(pending.has("vintage")).toBe(false);
  });

  it("照合中は生産国・品種だけに絞る（品名などは確定済み）", () => {
    const state = { ...initialLogFormState(null, NOW), drinkName: "", origin: "", variety: "" };
    const pending = pendingDrinkRecognizeFields(state, untouched, new Set(), DRINK_LOOKUP_FIELDS);
    expect([...pending].sort()).toEqual(["origin", "variety"]);
  });
});

describe("planDrinkLookup", () => {
  const extracted = {
    lookupSuggested: true,
    appellation: "Dogliani",
    fields: {
      drinkName: { value: "Dogliani Superiore", confidence: 0.9 },
      producer: { value: "Pecchenino", confidence: 0.9 },
      vintage: { value: 2020, confidence: 0.9 },
      drinkType: { value: "wine" as const, confidence: 0.8 },
    },
  };

  it("サーバーが勧め、国か品種が空なら品名・生産者・年・種類・原産地呼称を送る", () => {
    const state = initialLogFormState(null, NOW);
    expect(planDrinkLookup(extracted, state, untouched, new Set())).toEqual({
      drinkName: "Dogliani Superiore",
      producer: "Pecchenino",
      vintage: 2020,
      drinkType: "wine",
      appellation: "Dogliani",
    });
  });

  it("勧められていない・品名か生産者が無い・国と品種が埋まっているときは呼ばない", () => {
    const state = initialLogFormState(null, NOW);
    expect(
      planDrinkLookup({ ...extracted, lookupSuggested: false }, state, untouched, new Set()),
    ).toBeNull();
    expect(
      planDrinkLookup(
        { ...extracted, fields: { drinkName: extracted.fields.drinkName } },
        state,
        untouched,
        new Set(),
      ),
    ).toBeNull();
    expect(
      planDrinkLookup(
        extracted,
        { ...state, origin: "イタリア", variety: "Dolcetto" },
        { ...untouched, origin: true, variety: true },
        new Set(),
      ),
    ).toBeNull();
  });

  it("直前の AI 値が入っている欄はまだ埋め直せるので呼ぶ", () => {
    const state = { ...initialLogFormState(null, NOW), origin: "フランス", variety: "Merlot" };
    expect(
      planDrinkLookup(extracted, state, untouched, new Set(["origin", "variety"])),
    ).not.toBeNull();
  });
});

describe("settledRecognizeStatus", () => {
  it("1 件以上なら success、0 件なら empty", () => {
    expect(settledRecognizeStatus(2)).toBe("success");
    expect(settledRecognizeStatus(0)).toBe("empty");
  });
});

describe("drinkRecognizeBannerMessage", () => {
  it("成功は入れた件数を出し、0 件・失敗は手入力できることを添える", () => {
    expect(drinkRecognizeBannerMessage("loading", 0)).toBe(DRINK_RECOGNIZE_BANNER.loading);
    expect(drinkRecognizeBannerMessage("success", 3)).toBe(
      "写真から 3 項目を入れました（AI 印の欄。修正できます）",
    );
    expect(drinkRecognizeBannerMessage("empty", 0)).toContain("手で入力できます");
    expect(drinkRecognizeBannerMessage("failure", 0)).toContain("手で入力してください");
  });

  it("照合中は入れた件数を先に出して「調べています…」を添える", () => {
    expect(drinkRecognizeBannerMessage("lookup", 4)).toBe(
      "写真から 4 項目を入れました。生産国・品種を調べています…",
    );
    expect(drinkRecognizeBannerMessage("lookup", 0)).toBe(DRINK_RECOGNIZE_BANNER.lookup);
  });
});
