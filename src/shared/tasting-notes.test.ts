import { describe, expect, it } from "vitest";
import {
  createTastingNoteSchema,
  formatRatingX10,
  isTastedOnAllowed,
  isValidRatingX10,
  normalizeNoteText,
  RATING_X10_MAX,
  RATING_X10_MIN,
  ratingStarFill,
  ratingX10FromStar,
  stepRatingX10,
  TASTING_NOTE_MESSAGES,
  tastingNotesQuerySchema,
  updateTastingNoteSchema,
} from "./tasting-notes.ts";
import { tokyoToday } from "./tokyo-date.ts";
import "./zod-config.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const TODAY = tokyoToday();

const HAND = {
  drinkName: "サンプル赤",
  drinkType: "wine" as const,
  tastedOn: TODAY,
  ratingX10: 45,
};

function createMessages(input: unknown): Record<string, string[]> {
  const result = createTastingNoteSchema.safeParse(input);
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
  it("10〜50 の 5 刻みだけを合法とする", () => {
    expect(isValidRatingX10(10)).toBe(true);
    expect(isValidRatingX10(45)).toBe(true);
    expect(isValidRatingX10(50)).toBe(true);
    expect(isValidRatingX10(0)).toBe(false);
    expect(isValidRatingX10(11)).toBe(false);
    expect(isValidRatingX10(33)).toBe(false);
    expect(isValidRatingX10(3.3)).toBe(false);
  });

  it("表示は小数第 1 位、星は整数＋半星", () => {
    expect(formatRatingX10(40)).toBe("4.0");
    expect(formatRatingX10(45)).toBe("4.5");
    expect(ratingStarFill(45)).toEqual({ full: 4, half: true });
    expect(ratingStarFill(40)).toEqual({ full: 4, half: false });
    expect(ratingX10FromStar(3)).toBe(30);
  });

  it("未選択からの ± は 1.0。下限・上限で止める", () => {
    expect(stepRatingX10(null, 5)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(null, -5)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(10, -5)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(50, 5)).toBe(RATING_X10_MAX);
    expect(stepRatingX10(45, 5)).toBe(50);
    expect(stepRatingX10(15, -5)).toBe(10);
  });
});

describe("normalizeNoteText / isTastedOnAllowed", () => {
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
});

describe("createTastingNoteSchema", () => {
  it("手入力（銘柄・種類・評価・今日）が通る", () => {
    expect(createTastingNoteSchema.parse(HAND)).toEqual(HAND);
  });

  it("ボトルありなら銘柄・種類を省略できる", () => {
    const parsed = createTastingNoteSchema.parse({
      bottleId: UUID,
      tastedOn: TODAY,
      ratingX10: 40,
    });
    expect(parsed.bottleId).toBe(UUID);
    expect(parsed.drinkName).toBeUndefined();
  });

  it("ボトルなしで銘柄・種類が無いと 必須エラー", () => {
    const fields = createMessages({ tastedOn: TODAY, ratingX10: 40 });
    expect(fields.drinkName).toEqual([TASTING_NOTE_MESSAGES.drinkName]);
    expect(fields.drinkType).toEqual([TASTING_NOTE_MESSAGES.drinkType]);
  });

  it("評価 3.3 / 0 / 11 は不可", () => {
    expect(createMessages({ ...HAND, ratingX10: 3.3 }).ratingX10).toEqual([
      TASTING_NOTE_MESSAGES.rating,
    ]);
    expect(createMessages({ ...HAND, ratingX10: 0 }).ratingX10).toEqual([
      TASTING_NOTE_MESSAGES.rating,
    ]);
    expect(createMessages({ ...HAND, ratingX10: 11 }).ratingX10).toEqual([
      TASTING_NOTE_MESSAGES.rating,
    ]);
  });

  it("未来日と不正日、7 枚・重複 photoIds、未知キーを拒否する", () => {
    expect(createMessages({ ...HAND, tastedOn: "2099-01-01" }).tastedOn).toEqual([
      TASTING_NOTE_MESSAGES.tastedOnFuture,
    ]);
    expect(createMessages({ ...HAND, tastedOn: "2026-02-30" }).tastedOn).toEqual([
      TASTING_NOTE_MESSAGES.tastedOnFormat,
    ]);
    expect(
      createMessages({
        ...HAND,
        photoIds: Array.from({ length: 7 }, (_, i) => `11111111-1111-4111-8111-11111111111${i}`),
      }).photoIds,
    ).toEqual([TASTING_NOTE_MESSAGES.photoIdsMax]);
    expect(createMessages({ ...HAND, photoIds: [UUID, UUID] }).photoIds).toEqual([
      TASTING_NOTE_MESSAGES.photoIdsDuplicate,
    ]);
    expect(createMessages({ ...HAND, userId: "x" })[""]).toBeDefined();
  });
});

describe("updateTastingNoteSchema", () => {
  it("空オブジェクトは拒否し、bottleId null では銘柄・種類が必須", () => {
    expect(updateTastingNoteSchema.safeParse({}).success).toBe(false);
    const missing = updateTastingNoteSchema.safeParse({ bottleId: null });
    expect(missing.success).toBe(false);
    expect(
      updateTastingNoteSchema.safeParse({
        bottleId: null,
        drinkName: "手入力",
        drinkType: "beer",
      }).success,
    ).toBe(true);
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
