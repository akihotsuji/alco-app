import { describe, expect, it } from "vitest";
import {
  needsProductLookup,
  parseDrinkExtract,
  parseDrinkLookup,
  selectDrinkAutofillFields,
} from "./drink-extract.ts";

describe("selectDrinkAutofillFields", () => {
  it("ラベルに国・品種が書いてあれば入れる", () => {
    const extract = parseDrinkExtract({
      subject: "label",
      printedOrigin: { value: "フランス" },
      printedVariety: { value: "Pinot Noir" },
      drinkType: { value: "wine_red", confidence: 0.9 },
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.origin?.value).toBe("フランス");
    expect(fields.variety?.value).toBe("Pinot Noir");
    expect(fields.drinkType?.value).toBe("wine_red");
  });

  it("検証済み産地から国だけ補い、代表品種は入れない", () => {
    const extract = parseDrinkExtract({
      subject: "label",
      appellation: { value: "Barolo" },
      origin: { value: "イタリア", confidence: 0.9, evidence: "verified_origin" },
      variety: { value: "Nebbiolo", confidence: 0.9, evidence: "unverified_guess" },
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.origin?.value).toBe("イタリア");
    expect(fields.variety).toBeUndefined();
  });

  it("Made in China は中国にし、DOCG は空欄にする", () => {
    const china = selectDrinkAutofillFields(
      parseDrinkExtract({
        subject: "label",
        printedOrigin: { value: "MADE IN CHINA" },
      }),
      null,
    );
    expect(china.fields.origin?.value).toBe("中国");
    const docg = selectDrinkAutofillFields(
      parseDrinkExtract({
        subject: "label",
        printedOrigin: { value: "DOCG" },
      }),
      null,
    );
    expect(docg.fields.origin).toBeUndefined();
  });

  it("根拠のない推測は空欄にする", () => {
    const extract = parseDrinkExtract({
      subject: "label",
      origin: { value: "フランス", confidence: 0.95, evidence: "unverified_guess" },
      variety: { value: "Chardonnay", confidence: 0.9, evidence: "unverified_guess" },
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.origin).toBeUndefined();
    expect(fields.variety).toBeUndefined();
  });

  it("グラスだけの写真では国・品種・品名を入れない", () => {
    const extract = parseDrinkExtract({
      subject: "glass",
      drinkName: { value: "何か", confidence: 0.8, evidence: "unverified_guess" },
      origin: { value: "フランス", confidence: 0.8, evidence: "unverified_guess" },
      drinkType: { value: "wine_red", confidence: 0.8 },
      volumeMl: { value: 125, confidence: 0.7 },
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.drinkName).toBeUndefined();
    expect(fields.origin).toBeUndefined();
    expect(fields.drinkType?.value).toBe("wine_red");
    expect(fields.volumeMl?.value).toBe(125);
  });

  it("確認済み出典があるときだけ検索結果で空欄を埋める", () => {
    const extract = parseDrinkExtract({
      subject: "label",
      drinkName: { value: "Example Cuvee", confidence: 0.9, evidence: "label" },
      producer: { value: "Example Winery", confidence: 0.9, evidence: "label" },
    });
    const selected = selectDrinkAutofillFields(extract, {
      matched: true,
      origin: "フランス",
      variety: "Syrah",
      sources: [
        {
          url: "https://example-winery.test/cuvee",
          title: "Tech sheet",
          supports: ["origin", "variety"],
        },
      ],
    });
    expect(selected.fields.origin?.value).toBe("フランス");
    expect(selected.fields.variety?.value).toBe("Syrah");
    expect(selected.sources).toHaveLength(2);
  });

  it("モデルが作った URL は出典にしない", () => {
    const parsed = parseDrinkLookup(
      {
        matched: true,
        origin: { value: "フランス" },
        sources: [{ url: "https://invented.example/sheet", supports: ["origin"] }],
      },
      [{ url: "https://real.example/sheet" }],
    );
    expect(parsed.matched).toBe(false);
    expect(parsed.origin).toBeNull();
  });
});

describe("parseDrinkExtract", () => {
  it("平坦な JSON と日本語の種類を候補形へ直す", () => {
    const extract = parseDrinkExtract({
      subject: "label",
      drinkName: "獺祭",
      producer: "旭酒造",
      drinkType: "日本酒",
      volumeMl: 180,
      abvPercent: 16,
      origin: "日本",
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.drinkName?.value).toBe("獺祭");
    expect(fields.producer?.value).toBe("旭酒造");
    expect(fields.drinkType?.value).toBe("sake");
    expect(fields.volumeMl?.value).toBe(180);
    expect(fields.abvPercent?.value).toBe(16);
    expect(fields.origin?.value).toBe("日本");
  });

  it("Gemini candidates の平坦 JSON も同じ欄になる", () => {
    const extract = parseDrinkExtract({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: '{"subject":"label","drinkName":"Sample","drinkType":"beer","volumeMl":350}',
              },
            ],
          },
        },
      ],
    });
    const { fields } = selectDrinkAutofillFields(extract, null);
    expect(fields.drinkName?.value).toBe("Sample");
    expect(fields.drinkType?.value).toBe("beer");
    expect(fields.volumeMl?.value).toBe(350);
  });
});

describe("needsProductLookup", () => {
  it("品名と生産者が揃い国が無いとき真", () => {
    expect(
      needsProductLookup({
        drinkName: { value: "A", confidence: 0.9 },
        producer: { value: "B", confidence: 0.9 },
      }),
    ).toBe(true);
    expect(
      needsProductLookup({
        drinkName: { value: "A", confidence: 0.9 },
        producer: { value: "B", confidence: 0.9 },
        origin: { value: "フランス", confidence: 0.9 },
        variety: { value: "Pinot Noir", confidence: 0.9 },
      }),
    ).toBe(false);
    expect(needsProductLookup({ drinkName: { value: "A", confidence: 0.9 } })).toBe(false);
  });

  it("品種欠はワイン系だけ検索する", () => {
    expect(
      needsProductLookup({
        drinkName: { value: "A", confidence: 0.9 },
        producer: { value: "B", confidence: 0.9 },
        origin: { value: "日本", confidence: 0.9 },
        drinkType: { value: "sake", confidence: 0.9 },
      }),
    ).toBe(false);
    expect(
      needsProductLookup({
        drinkName: { value: "A", confidence: 0.9 },
        producer: { value: "B", confidence: 0.9 },
        origin: { value: "フランス", confidence: 0.9 },
        drinkType: { value: "wine_red", confidence: 0.9 },
      }),
    ).toBe(true);
  });
});
