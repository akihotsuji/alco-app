import { Star } from "lucide-react";
import { ratingStarFill, ratingX10FromStar } from "@/shared/tasting-notes.ts";

type RatingStarsProps = {
  ratingX10: number | null;
  size?: number;
  interactive?: boolean;
  onSelectStar?: (ratingX10: number) => void;
};

function StarGlyph({ size, filled, half }: { size: number; filled: boolean; half: boolean }) {
  return (
    <span className="note-star">
      <Star size={size} className="note-star-empty" aria-hidden />
      <span className={half ? "note-star-fill is-half" : "note-star-fill"} aria-hidden>
        {filled || half ? <Star size={size} className="note-star-on" aria-hidden /> : null}
      </span>
    </span>
  );
}

export function RatingStars({
  ratingX10,
  size = 20,
  interactive = false,
  onSelectStar,
}: RatingStarsProps) {
  const fill = ratingX10 === null ? { full: 0, half: false } : ratingStarFill(ratingX10);
  const summary = ratingX10 === null ? "評価未選択" : `評価 ${ratingX10 / 10}`;

  if (interactive && onSelectStar) {
    return (
      <div className="note-stars" role="radiogroup" aria-label="評価">
        <span className="visually-hidden">{summary}</span>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= fill.full;
          const half = fill.half && star === fill.full + 1;
          return (
            // biome-ignore lint/a11y/useSemanticElements: 同じ星の再タップで +0.5。native radio は選択済みで change しない
            <button
              key={star}
              type="button"
              role="radio"
              className="note-star-button"
              aria-label={`評価 ${star}`}
              aria-checked={filled || half}
              onClick={() => onSelectStar(ratingX10FromStar(star))}
            >
              <StarGlyph size={size} filled={filled} half={half} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="note-stars">
      <span className="visually-hidden">{summary}</span>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= fill.full;
        const half = fill.half && star === fill.full + 1;
        return (
          <span key={star}>
            <StarGlyph size={size} filled={filled} half={half} />
          </span>
        );
      })}
    </div>
  );
}
