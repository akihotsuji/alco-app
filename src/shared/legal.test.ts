import { describe, expect, it } from "vitest";
import {
  formatLegalEffectiveOn,
  LEGAL_VERSION,
  legalBackFallback,
  legalHref,
  signupLegalAcceptanceSchema,
} from "./legal.ts";

describe("signupLegalAcceptanceSchema", () => {
  it("現行版への同意だけ通す", () => {
    expect(
      signupLegalAcceptanceSchema.safeParse({
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      }).success,
    ).toBe(true);
    expect(
      signupLegalAcceptanceSchema.safeParse({
        acceptedLegal: false,
        legalVersion: LEGAL_VERSION,
      }).success,
    ).toBe(false);
    expect(
      signupLegalAcceptanceSchema.safeParse({
        acceptedLegal: true,
        legalVersion: "2010-01-01",
      }).success,
    ).toBe(false);
  });
});

describe("legalBackFallback", () => {
  it("from に応じて戻り先を決め、不正はサインアップ", () => {
    expect(legalBackFallback("signup")).toBe("/signup");
    expect(legalBackFallback("login")).toBe("/login");
    expect(legalBackFallback("settings")).toBe("/settings");
    expect(legalBackFallback(null)).toBe("/signup");
    expect(legalBackFallback("/evil")).toBe("/signup");
  });
});

describe("legalHref", () => {
  it("from をクエリに付ける", () => {
    expect(legalHref("/terms", "signup")).toBe("/terms?from=signup");
    expect(legalHref("/privacy", null)).toBe("/privacy");
  });
});

describe("formatLegalEffectiveOn", () => {
  it("暦日を日本語にする", () => {
    expect(formatLegalEffectiveOn("2026-09-09")).toBe("2026年9月9日");
    expect(formatLegalEffectiveOn("bad")).toBe("bad");
  });
});
