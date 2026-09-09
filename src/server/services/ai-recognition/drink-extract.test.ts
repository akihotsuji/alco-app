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

describe("needsProductLookup", () => {
  it("品名と生産者が揃い国か品種が無いときだけ真", () => {
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
});
