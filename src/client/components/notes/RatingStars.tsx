import { Star } from "lucide-react";
import { ratingStarFill, ratingX10FromStar } from "@/shared/tasting-notes.ts";

type RatingStarsProps = {
  ratingX10: number | null;
  size?: number;
  interactive?: boolean;
  onSelectStar?: (ratingX10: number) => void;
};

export function RatingStars({
  ratingX10,
  size = 20,
  interactive = false,
  onSelectStar,
}: RatingStarsProps) {
  const fill = ratingX10 === null ? { full: 0, half: false } : ratingStarFill(ratingX10);

  return (
    <div className="note-stars">
      <span className="visually-hidden">
        {ratingX10 === null ? "評価未選択" : `評価 ${ratingX10 / 10}`}
      </span>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= fill.full;
        const half = fill.half && star === fill.full + 1;
        const content = (
          <span className="note-star">
            <Star size={size} className="note-star-empty" aria-hidden />
            <span className={half ? "note-star-fill is-half" : "note-star-fill"} aria-hidden>
              {filled || half ? <Star size={size} className="note-star-on" aria-hidden /> : null}
            </span>
          </span>
        );
        if (!interactive || !onSelectStar) {
          return <span key={star}>{content}</span>;
        }
        return (
          <button
            key={star}
            type="button"
            className="note-star-button"
            aria-label={`評価 ${star}`}
            onClick={() => onSelectStar(ratingX10FromStar(star))}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
