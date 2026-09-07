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
  stepRatingX10,
} from "@/shared/tasting-notes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const field = readFileSync(join(here, "RatingField.tsx"), "utf8");
const stars = readFileSync(join(here, "RatingStars.tsx"), "utf8");
const form = readFileSync(join(here, "NoteForm.tsx"), "utf8");

describe("RatingField ステッパー", () => {
  it("± は 0.5（ratingX10 で 5）。未選択から 1.0、上限は 5.0", () => {
    const stepped: number[] = [];
    let current: number | null = null;
    for (let i = 0; i < 10; i += 1) {
      current = stepRatingX10(current, RATING_X10_STEP);
      stepped.push(current);
    }
    expect(stepped).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50, 50]);
    expect(formatRatingX10(stepped[0] ?? 0)).toBe("1.0");
    expect(formatRatingX10(RATING_X10_MAX)).toBe("5.0");
    expect(stepRatingX10(RATING_X10_MIN, -RATING_X10_STEP)).toBe(RATING_X10_MIN);
    expect(stepRatingX10(RATING_X10_MAX, RATING_X10_STEP)).toBe(RATING_X10_MAX);
  });

  it("星タップは整数 1〜5。ステッパーは下限・上限で disabled", () => {
    expect(field).toContain("stepRatingX10(value, -5)");
    expect(field).toContain("stepRatingX10(value, 5)");
    expect(field).toContain("disabled={value === RATING_X10_MIN}");
    expect(field).toContain("disabled={value === RATING_X10_MAX}");
    expect(field).toContain("評価を下げる");
    expect(field).toContain("評価を上げる");
    expect(field).toContain('className="field-error"');
    expect(stars).toContain("[1, 2, 3, 4, 5]");
    expect(stars).toContain("ratingX10FromStar(star)");
    expect(ratingX10FromStar(1)).toBe(10);
    expect(ratingX10FromStar(5)).toBe(50);
    expect(form).toContain("<RatingField");
    expect(form).not.toContain("dangerouslySetInnerHTML");
  });
});
