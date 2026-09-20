import { describe, expect, it } from "vitest";
import {
  drinkLogTastingNoteInputSchema,
  formatRatingX10,
  isTastedOnAllowed,
  isValidRatingX10,
  normalizeNoteText,
  RATING_X10_MAX,
  RATING_X10_MIN,
  ratingStarFill,
  ratingX10FromStar,
  ratingX10FromStarTap,
  snapshotDrinkName,
  stepRatingX10,
  TASTING_NOTE_MESSAGES,
  tastingNotesQuerySchema,
} from "./tasting-notes.ts";
import { tokyoToday } from "./tokyo-date.ts";
import "./zod-config.ts";

const UUID = "11111111-1111-4111-8111-111111111111";

function createMessages(input: unknown): Record<string, string[]> {
  const result = drinkLogTastingNoteInputSchema.safeParse(input);
  if (result.success) {
    return {};
  }
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

describe("ratingX10 helpers", () => {
  it("10〜50 の 1 刻み（0.1）だけを合法とする", () => {
    expect(isValidRatingX10(10)).toBe(true);
    expect(isValidRatingX10(11)).toBe(true);
    expect(isValidRatingX10(33)).toBe(true);
    expect(isValidRatingX10(45)).toBe(true);
    expect(isValidRatingX10(50)).toBe(true);
    expect(isValidRatingX10(0)).toBe(false);
    expect(isValidRatingX10(9)).toBe(false);
    expect(isValidRatingX10(3.3)).toBe(false);
    expect(isValidRatingX10(5.1)).toBe(false);
    expect(isValidRatingX10(1.2)).toBe(false);
    expect(isValidRatingX10(51)).toBe(false);
  });

  it("表示は小数第 1 位、星は整数＋余り割合", () => {
    expect(formatRatingX10(40)).toBe("4.0");
    expect(formatRatingX10(42)).toBe("4.2");
    expect(formatRatingX10(45)).toBe("4.5");
    expect(ratingStarFill(45)).toEqual({ full: 4, fraction: 0.5 });
    expect(ratingStarFill(43)).toEqual({ full: 4, fraction: 0.3 });
    expect(ratingStarFill(40)).toEqual({ full: 4, fraction: 0 });
    expect(ratingX10FromStar(3)).toBe(30);
    expect(ratingX10FromStarTap(null, 4)).toBe(40);
    expect(ratingX10FromStarTap(40, 4)).toBe(40);
    expect(ratingX10FromStarTap(41, 4)).toBe(40);
    expect(ratingX10FromStarTap(50, 5)).toBe(50);
  });

  it("未選択からの ± は 1.0。下限・上限で止める", () => {
    expect(stepRatingX10(null, 1)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(null, -1)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(10, -1)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(50, 1)).toBe(RATING_X10_MAX);
    expect(stepRatingX10(49, 1)).toBe(50);
    expect(stepRatingX10(11, -1)).toBe(10);
  });
});

describe("normalizeNoteText / isTastedOnAllowed / snapshotDrinkName", () => {
  it("前後空白だけなら null、本文は trim する", () => {
    expect(normalizeNoteText("  \n ")).toBeNull();
    expect(normalizeNoteText("  酸がきれい  ")).toBe("酸がきれい");
    expect(normalizeNoteText(null)).toBeNull();
  });

  it("今日は可、未来と不正日は不可", () => {
    const now = new Date("2026-09-07T03:00:00.000Z");
    expect(isTastedOnAllowed("2026-09-07", now)).toBe(true);
    expect(isTastedOnAllowed("2026-09-08", now)).toBe(false);
    expect(isTastedOnAllowed("2026-02-30", now)).toBe(false);
  });

  it("品名が空なら種類の表示名を使う", () => {
    expect(snapshotDrinkName("  赤  ", "wine")).toBe("赤");
    expect(snapshotDrinkName(null, "beer")).toBe("ビール");
    expect(snapshotDrinkName("   ", "wine_red")).toBe("赤ワイン");
  });
});

describe("drinkLogTastingNoteInputSchema", () => {
  it("評価だけ通る。識別・日付は受け取らない", () => {
    expect(drinkLogTastingNoteInputSchema.parse({ ratingX10: 45 })).toEqual({ ratingX10: 45 });
    expect(createMessages({ ratingX10: 45, drinkName: "赤" })[""]).toBeDefined();
    expect(createMessages({ ratingX10: 45, tastedOn: tokyoToday() })[""]).toBeDefined();
  });

  it("評価 5.1 / 1.2 / 0 / 9 は不可。1.1（11）は可", () => {
    expect(createMessages({ ratingX10: 3.3 }).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(createMessages({ ratingX10: 5.1 }).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(createMessages({ ratingX10: 1.2 }).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(createMessages({ ratingX10: 0 }).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(createMessages({ ratingX10: 9 }).ratingX10).toEqual([TASTING_NOTE_MESSAGES.rating]);
    expect(drinkLogTastingNoteInputSchema.parse({ ratingX10: 11 }).ratingX10).toBe(11);
    expect(drinkLogTastingNoteInputSchema.parse({ ratingX10: 42 }).ratingX10).toBe(42);
  });

  it("7 枚・重複 photoIds、未知キーを拒否する", () => {
    expect(
      createMessages({
        ratingX10: 40,
        photoIds: Array.from({ length: 7 }, (_, i) => `11111111-1111-4111-8111-11111111111${i}`),
      }).photoIds,
    ).toEqual([TASTING_NOTE_MESSAGES.photoIdsMax]);
    expect(createMessages({ ratingX10: 40, photoIds: [UUID, UUID] }).photoIds).toEqual([
      TASTING_NOTE_MESSAGES.photoIdsDuplicate,
    ]);
    expect(createMessages({ ratingX10: 40, userId: "x" })[""]).toBeDefined();
  });
});

describe("tastingNotesQuerySchema", () => {
  it("既定 limit 50。評価範囲の逆転と長い q を拒否する", () => {
    expect(tastingNotesQuerySchema.parse({}).limit).toBe(50);
    expect(tastingNotesQuerySchema.safeParse({ ratingX10Min: 50, ratingX10Max: 40 }).success).toBe(
      false,
    );
    expect(tastingNotesQuerySchema.safeParse({ q: "あ".repeat(101) }).success).toBe(false);
    expect(tastingNotesQuerySchema.parse({ ratingX10Min: "40" }).ratingX10Min).toBe(40);
  });
});
