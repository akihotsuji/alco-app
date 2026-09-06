import { describe, expect, it } from "vitest";
import { calculateAlcoholGrams as fromShared } from "@/shared/alcohol.ts";
import { calculateAlcoholGrams } from "./alcohol.ts";

describe("client alcohol", () => {
  it("shared と同じ calculateAlcoholGrams を import する", () => {
    expect(calculateAlcoholGrams).toBe(fromShared);
    expect(calculateAlcoholGrams(125, 12)).toBe(12);
  });
});
