import { describe, expect, it } from "vitest";
import { countryFromVerifiedAppellation, normalizeAppellationKey } from "./verified-origin.ts";

describe("countryFromVerifiedAppellation", () => {
  it("検証済みの産地だけ国を返す", () => {
    expect(countryFromVerifiedAppellation("Bordeaux")).toBe("フランス");
    expect(countryFromVerifiedAppellation("Champagne")).toBe("フランス");
    expect(countryFromVerifiedAppellation("Barolo")).toBe("イタリア");
    expect(countryFromVerifiedAppellation("Rioja")).toBe("スペイン");
    expect(countryFromVerifiedAppellation("Napa Valley")).toBe("アメリカ");
  });

  it("品種名・酒の種類・未知の産地は返さない", () => {
    expect(countryFromVerifiedAppellation("Cabernet Sauvignon")).toBeNull();
    expect(countryFromVerifiedAppellation("日本酒")).toBeNull();
    expect(countryFromVerifiedAppellation("sake")).toBeNull();
    expect(countryFromVerifiedAppellation("")).toBeNull();
  });

  it("DOCG・AOC などの修飾語を除いて照合する", () => {
    expect(countryFromVerifiedAppellation("Dogliani DOCG")).toBe("イタリア");
    expect(countryFromVerifiedAppellation("Langhe Nebbiolo")).toBe("イタリア");
    expect(countryFromVerifiedAppellation("Barolo DOCG")).toBe("イタリア");
    expect(countryFromVerifiedAppellation("Appellation Margaux Contrôlée")).toBe("フランス");
    expect(countryFromVerifiedAppellation("Rioja Reserva")).toBe("スペイン");
    expect(countryFromVerifiedAppellation("Islay Single Malt Scotch Whisky")).toBe("イギリス");
  });

  it("都道府県名は日本を返す", () => {
    expect(countryFromVerifiedAppellation("山梨県")).toBe("日本");
    expect(countryFromVerifiedAppellation("北海道")).toBe("日本");
    expect(countryFromVerifiedAppellation("新潟")).toBe("日本");
    expect(countryFromVerifiedAppellation("Yamanashi")).toBe("日本");
  });

  it("複数の国が混ざる表記は返さない", () => {
    expect(countryFromVerifiedAppellation("Bordeaux Napa Blend")).toBeNull();
    expect(countryFromVerifiedAppellation("Nebbiolo")).toBeNull();
  });

  it("アクセント付き表記を正規化する", () => {
    expect(normalizeAppellationKey("Châteauneuf-du-Pape")).toBe("chateauneuf_du_pape");
    expect(countryFromVerifiedAppellation("Châteauneuf-du-Pape")).toBe("フランス");
  });
});
