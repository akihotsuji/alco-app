import { describe, expect, it } from "vitest";
import {
  emptyIdentity,
  normalizeOptionalText,
  resolveIdentityFields,
  vintageSchema,
} from "./identity.ts";

describe("normalizeOptionalText", () => {
  it("前後空白を除いて空なら null", () => {
    expect(normalizeOptionalText("  ")).toBeNull();
    expect(normalizeOptionalText("  生産者  ")).toBe("生産者");
    expect(normalizeOptionalText(null)).toBeNull();
  });
});

describe("resolveIdentityFields", () => {
  it("ボディがあれば採用し、省略時はフォールバック", () => {
    const bottle = {
      producer: "ワイナリー",
      origin: "フランス",
      variety: "ピノ",
      vintage: 2019,
    };
    expect(resolveIdentityFields({}, bottle)).toEqual(bottle);
    expect(
      resolveIdentityFields({ producer: " 手入力 ", vintage: null }, bottle),
    ).toEqual({
      producer: "手入力",
      origin: "フランス",
      variety: "ピノ",
      vintage: null,
    });
    expect(resolveIdentityFields({}, null)).toEqual(emptyIdentity());
  });
});

describe("vintageSchema", () => {
  it("1800〜2100 の整数だけ通す", () => {
    expect(vintageSchema.safeParse(1800).success).toBe(true);
    expect(vintageSchema.safeParse(2100).success).toBe(true);
    expect(vintageSchema.safeParse(1799).success).toBe(false);
    expect(vintageSchema.safeParse(2019.5).success).toBe(false);
  });
});
