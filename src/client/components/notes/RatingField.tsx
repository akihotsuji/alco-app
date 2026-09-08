import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { RatingStars } from "@/client/components/notes/RatingStars.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import { formatRatingX10, isValidRatingX10, ratingX10FromStarTap } from "@/shared/tasting-notes.ts";

type RatingFieldProps = {
  value: number | null;
  error?: string;
  onChange: (ratingX10: number | null) => void;
};

function parseRatingInput(raw: string): number | null | undefined {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const ratingX10 = Math.round(parsed * 10);
  return isValidRatingX10(ratingX10) ? ratingX10 : undefined;
}

/** N5: 星タップが主。同じ星の再タップで +0.5。数値欄でキーボード操作 */
export function RatingField({ value, error, onChange }: RatingFieldProps) {
  return (
    <fieldset className="log-form-section">
      <legend>
        <FieldLabel required>評価</FieldLabel>
      </legend>
      <div className="note-rating-cluster">
        <RatingStars
          ratingX10={value}
          size={32}
          interactive
          onSelectStar={(next) => {
            haptic("light");
            onChange(ratingX10FromStarTap(value, next / 10));
          }}
        />
        <label className="note-rating-number">
          <span className="visually-hidden">評価（1.0〜5.0、0.5刻み）</span>
          <input
            type="number"
            inputMode="decimal"
            className="note-rating-input"
            min={1}
            max={5}
            step={0.5}
            placeholder="未選択"
            value={value === null ? "" : String(value / 10)}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              const parsed = parseRatingInput(event.target.value);
              if (parsed !== undefined) {
                onChange(parsed);
              }
            }}
          />
        </label>
      </div>
      <p className="field-hint" aria-live="polite">
        {value === null ? "タップして評価" : `${formatRatingX10(value)}`}
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
