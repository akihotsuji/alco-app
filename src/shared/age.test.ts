import { describe, expect, it } from "vitest";
import {
  AGE_BIRTH_ON_MESSAGE,
  isAtLeastAge,
  majorityReachedOn,
  verifyAgeBodySchema,
} from "./age.ts";

describe("majorityReachedOn", () => {
  it("20 歳の誕生日の前日を返す", () => {
    expect(majorityReachedOn("2006-04-01")).toBe("2026-03-31");
    expect(majorityReachedOn("2006-09-10")).toBe("2026-09-09");
    expect(majorityReachedOn("2004-02-29")).toBe("2024-02-28");
  });
});

describe("isAtLeastAge", () => {
  it("誕生日の前日から満 20 歳", () => {
    expect(isAtLeastAge("2006-04-01", "2026-03-30")).toBe(false);
    expect(isAtLeastAge("2006-04-01", "2026-03-31")).toBe(true);
    expect(isAtLeastAge("2006-04-01", "2026-04-01")).toBe(true);
    expect(isAtLeastAge("2006-09-10", "2026-09-09")).toBe(true);
    expect(isAtLeastAge("2006-09-11", "2026-09-09")).toBe(false);
  });

  it("2 月 29 日生まれは閏年の応当日の前日", () => {
    expect(isAtLeastAge("2004-02-29", "2024-02-27")).toBe(false);
    expect(isAtLeastAge("2004-02-29", "2024-02-28")).toBe(true);
    expect(isAtLeastAge("2004-02-29", "2024-02-29")).toBe(true);
  });

  it("不正な日付は false", () => {
    expect(isAtLeastAge("2026-02-30", "2026-09-09")).toBe(false);
    expect(isAtLeastAge("2006-04-01", "nope")).toBe(false);
  });
});

describe("verifyAgeBodySchema", () => {
  it("実在する YYYY-MM-DD だけ通し、未知キーは拒否する", () => {
    expect(verifyAgeBodySchema.parse({ birthOn: "1990-01-15" })).toEqual({
      birthOn: "1990-01-15",
    });
    expect(verifyAgeBodySchema.safeParse({ birthOn: "2026-02-30" }).success).toBe(false);
    expect(verifyAgeBodySchema.safeParse({ birthOn: "1990-1-15" }).success).toBe(false);
    expect(verifyAgeBodySchema.safeParse({ birthOn: "1990-01-15", isOver20: true }).success).toBe(
      false,
    );
    expect(verifyAgeBodySchema.safeParse({}).success).toBe(false);
    const failed = verifyAgeBodySchema.safeParse({ birthOn: "not-a-date" });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.issues[0]?.message).toBe(AGE_BIRTH_ON_MESSAGE);
    }
  });
});
