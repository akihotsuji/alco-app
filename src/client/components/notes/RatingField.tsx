import type { CSSProperties } from "react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { RatingStars } from "@/client/components/notes/RatingStars.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import {
  formatRatingX10,
  RATING_X10_MAX,
  RATING_X10_MIN,
  RATING_X10_STEP,
  ratingSliderFillRatio,
  ratingX10FromSlider,
  ratingX10FromStarTap,
} from "@/shared/tasting-notes.ts";

type RatingFieldProps = {
  value: number | null;
  error?: string;
  guideTarget?: string;
  onChange: (ratingX10: number | null) => void;
};

const STAR_SIZE = 32;
const RATING_SLIDER_ID = "note-rating";

/**
 * N5: スライダーが主。動かすと星が連動して埋まる（0.5 刻み）。
 * 星タップは整数のショートカット（同じ星の再タップで +0.5）。数値は読み取り専用の大きな表示。
 * 未選択ではバーが空でつまみだけ 1.0 の位置にあり、触った瞬間に値が入る。
 */
export function RatingField({ value, error, guideTarget, onChange }: RatingFieldProps) {
  const sliderValue = value === null ? RATING_X10_MIN : value;
  const fillStyle = { "--rating-fill": ratingSliderFillRatio(value) } as CSSProperties;

  function commit(next: number) {
    if (next === value) {
      return;
    }
    haptic("light");
    onChange(next);
  }

  return (
    <fieldset
      className="log-form-section"
      data-guide-target={guideTarget}
      onPointerDown={() => {
        if (guideTarget && value !== null) {
          onChange(value);
        }
      }}
    >
      <legend>
        <FieldLabel required>評価</FieldLabel>
      </legend>
      <div className={`note-rating${value === null ? " is-unset" : ""}`} style={fillStyle}>
        <div className="note-rating-head">
          <RatingStars
            ratingX10={value}
            size={STAR_SIZE}
            interactive
            onSelectStar={(next) => commit(ratingX10FromStarTap(value, next / 10))}
          />
          <output
            className="note-rating-value"
            htmlFor={RATING_SLIDER_ID}
            aria-live="polite"
            aria-label="選んだ評価"
          >
            {value === null ? "—" : formatRatingX10(value)}
          </output>
        </div>
        <input
          id={RATING_SLIDER_ID}
          type="range"
          className="note-rating-slider"
          min={RATING_X10_MIN / 10}
          max={RATING_X10_MAX / 10}
          step={RATING_X10_STEP / 10}
          value={sliderValue / 10}
          aria-label="評価（1.0〜5.0、0.5刻み）"
          aria-valuetext={value === null ? "未選択" : formatRatingX10(value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(RATING_SLIDER_ID, error)}
          onChange={(event) => {
            const next = ratingX10FromSlider(event.target.value);
            if (next !== null) {
              commit(next);
            }
          }}
          onClick={(event) => {
            // 1.0 の位置をそのまま押したときは change が来ないので、ここで値を入れる
            if (value === null) {
              const next = ratingX10FromSlider(event.currentTarget.value);
              if (next !== null) {
                commit(next);
              }
            }
          }}
        />
      </div>
      <p className="field-hint">
        {value === null ? "スライドして評価（星をタップしても選べます）" : "0.5 刻みで動かせます"}
      </p>
      <FieldError id={RATING_SLIDER_ID} error={error} />
    </fieldset>
  );
}
