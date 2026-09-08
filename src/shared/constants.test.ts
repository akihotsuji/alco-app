import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRINK_TYPE,
  DRINK_TYPES,
  isWineFamily,
  normalizeRecognizedDrinkType,
} from "./constants.ts";

describe("drink types", () => {
  it("12 種で赤ワインが既定", () => {
    expect(DRINK_TYPES).toHaveLength(12);
    expect(DEFAULT_DRINK_TYPE).toBe("wine_red");
    expect(isWineFamily("wine_red")).toBe(true);
    expect(isWineFamily("wine")).toBe(true);
    expect(isWineFamily("beer")).toBe(false);
  });

  it("認識の別名を 12 種へ寄せる", () => {
    expect(normalizeRecognizedDrinkType("wine_white")).toBe("wine_white");
    expect(normalizeRecognizedDrinkType("Red Wine")).toBe("wine_red");
    expect(normalizeRecognizedDrinkType("rosé")).toBe("wine_rose");
    expect(normalizeRecognizedDrinkType("prosecco")).toBe("wine_sparkling");
    expect(normalizeRecognizedDrinkType("amber")).toBe("wine_orange");
    expect(normalizeRecognizedDrinkType("vodka")).toBeNull();
  });
});
