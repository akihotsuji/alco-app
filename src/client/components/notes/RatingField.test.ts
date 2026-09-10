import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatRatingX10,
  RATING_X10_MAX,
  RATING_X10_MIN,
  RATING_X10_STEP,
  ratingSliderFillRatio,
  ratingX10FromSlider,
  ratingX10FromStar,
  ratingX10FromStarTap,
  stepRatingX10,
} from "@/shared/tasting-notes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const field = readFileSync(join(here, "RatingField.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");
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

  it("スライダー（1.0〜5.0、0.5 刻み）が主で星が連動する。星タップは整数、再タップで +0.5", () => {
    expect(ratingX10FromStarTap(null, 4)).toBe(40);
    expect(ratingX10FromStarTap(40, 4)).toBe(45);
    expect(ratingX10FromStarTap(45, 4)).toBe(40);
    expect(ratingX10FromStarTap(50, 5)).toBe(50);
    expect(ratingX10FromStarTap(45, 5)).toBe(50);
    expect(field).toContain("ratingX10FromStarTap");
    expect(field).toContain('type="range"');
    expect(field).toContain("step={RATING_X10_STEP / 10}");
    expect(field).toContain('aria-valuetext={value === null ? "未選択"');
    expect(field).toContain("評価（1.0〜5.0、0.5刻み）");
    expect(field).toContain('"--rating-fill": ratingSliderFillRatio(value)');
    expect(field).not.toContain('type="number"');
    expect(field).not.toContain("評価を下げる");
    expect(field).not.toContain("評価を上げる");
    expect(field).toContain("<FieldError");
    expect(css).toContain(".note-rating-slider::-webkit-slider-thumb");
    expect(css).toContain(".note-rating-slider::-moz-range-thumb");
    expect(css).toContain(".note-rating.is-unset");
    expect(stars).toContain("[1, 2, 3, 4, 5]");
    expect(stars).toContain('role="radiogroup"');
    expect(stars).toContain('role="radio"');
    expect(stars).toContain("ratingX10FromStar(star)");
    expect(ratingX10FromStar(1)).toBe(10);
    expect(ratingX10FromStar(5)).toBe(50);
    expect(form).toContain("<RatingField");
    expect(form).not.toContain("dangerouslySetInnerHTML");
  });

  it("スライダーの値と塗り: 文字列値を ratingX10 に、塗りは可動域に対する 0〜1", () => {
    expect(ratingX10FromSlider("1")).toBe(10);
    expect(ratingX10FromSlider("4.5")).toBe(45);
    expect(ratingX10FromSlider("5")).toBe(50);
    expect(ratingX10FromSlider("0.5")).toBeNull();
    expect(ratingX10FromSlider("4.2")).toBeNull();
    expect(ratingX10FromSlider("abc")).toBeNull();
    expect(ratingSliderFillRatio(null)).toBe(0);
    expect(ratingSliderFillRatio(RATING_X10_MIN)).toBe(0);
    expect(ratingSliderFillRatio(30)).toBe(0.5);
    expect(ratingSliderFillRatio(RATING_X10_MAX)).toBe(1);
  });
});
