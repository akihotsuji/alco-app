import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatRatingX10,
  RATING_X10_MAX,
  RATING_X10_MIN,
  RATING_X10_STEP,
  ratingX10FromStar,
  ratingX10FromStarTap,
  stepRatingX10,
} from "@/shared/tasting-notes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const field = readFileSync(join(here, "RatingField.tsx"), "utf8");
const stars = readFileSync(join(here, "RatingStars.tsx"), "utf8");
const form = readFileSync(join(here, "NoteForm.tsx"), "utf8");

describe("RatingField 星タップと数値", () => {
  it("± は 0.5（ratingX10 で 5）。未選択から 1.0、上限は 5.0", () => {
    const stepped: number[] = [];
    let current: number | null = null;
    for (let i = 0; i < 10; i += 1) {
      current = stepRatingX10(current, 5);
      stepped.push(current);
    }
    expect(stepped).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50, 50]);
    expect(formatRatingX10(stepped[0] ?? 0)).toBe("1.0");
    expect(formatRatingX10(RATING_X10_MAX)).toBe("5.0");
    expect(stepRatingX10(RATING_X10_MIN, -5)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(RATING_X10_MAX, 5)).toBe(RATING_X10_MAX);
    expect(RATING_X10_STEP).toBe(5);
  });

  it("同じ星の再タップで +0.5。5.0 は上限。数値欄でキーボード操作", () => {
    expect(ratingX10FromStarTap(null, 4)).toBe(40);
    expect(ratingX10FromStarTap(40, 4)).toBe(45);
    expect(ratingX10FromStarTap(45, 4)).toBe(40);
    expect(ratingX10FromStarTap(50, 5)).toBe(50);
    expect(ratingX10FromStarTap(45, 5)).toBe(50);
    expect(field).toContain("ratingX10FromStarTap");
    expect(field).toContain("step={0.5}");
    expect(field).toContain('placeholder="未選択"');
    expect(field).toContain("評価（1.0〜5.0、0.5刻み）");
    expect(field).not.toContain("評価を下げる");
    expect(field).not.toContain("評価を上げる");
    expect(field).toContain('className="field-error"');
    expect(stars).toContain("[1, 2, 3, 4, 5]");
    expect(stars).toContain("ratingX10FromStar(star)");
    expect(ratingX10FromStar(1)).toBe(10);
    expect(ratingX10FromStar(5)).toBe(50);
    expect(form).toContain("<RatingField");
    expect(form).not.toContain("dangerouslySetInnerHTML");
  });
});
