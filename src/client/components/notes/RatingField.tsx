import { Minus, Plus } from "lucide-react";
import { RatingStars } from "@/client/components/notes/RatingStars.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import {
  formatRatingX10,
  RATING_X10_MAX,
  RATING_X10_MIN,
  stepRatingX10,
} from "@/shared/tasting-notes.ts";

type RatingFieldProps = {
  value: number | null;
  error?: string;
  onChange: (ratingX10: number) => void;
};

export function RatingField({ value, error, onChange }: RatingFieldProps) {
  return (
    <fieldset className="log-form-section">
      <legend className="field-label">評価</legend>
      <div className="score-row note-rating-row">
        <RatingStars
          ratingX10={value}
          size={24}
          interactive
          onSelectStar={(next) => {
            haptic("light");
            onChange(next);
          }}
        />
        <span className="score-value">{value === null ? "" : formatRatingX10(value)}</span>
        <div className="stepper">
          <IconButton
            label="評価を下げる"
            size="icon-lg"
            disabled={value === RATING_X10_MIN}
            onClick={() => {
              haptic("light");
              onChange(stepRatingX10(value, -5));
            }}
          >
            <Minus size={22} />
          </IconButton>
          <IconButton
            label="評価を上げる"
            size="icon-lg"
            disabled={value === RATING_X10_MAX}
            onClick={() => {
              haptic("light");
              onChange(stepRatingX10(value, 5));
            }}
          >
            <Plus size={22} />
          </IconButton>
        </div>
      </div>
      {value !== null && value <= RATING_X10_MIN ? (
        <span className="visually-hidden">評価の下限です</span>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
