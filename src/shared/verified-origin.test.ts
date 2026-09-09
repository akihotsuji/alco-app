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

  it("アクセント付き表記を正規化する", () => {
    expect(normalizeAppellationKey("Châteauneuf-du-Pape")).toBe("chateauneuf_du_pape");
    expect(countryFromVerifiedAppellation("Châteauneuf-du-Pape")).toBe("フランス");
  });
});
