import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import { ratingStarFill, ratingX10FromStar } from "@/shared/tasting-notes.ts";

type RatingStarsProps = {
  ratingX10: number | null;
  size?: number;
  interactive?: boolean;
  onSelectStar?: (ratingX10: number) => void;
};

function starFillAt(ratingX10: number | null, star: number): number {
  if (ratingX10 === null) {
    return 0;
  }
  const fill = ratingStarFill(ratingX10);
  if (star <= fill.full) {
    return 1;
  }
  if (star === fill.full + 1) {
    return fill.fraction;
  }
  return 0;
}

function StarGlyph({ size, fill }: { size: number; fill: number }) {
  return (
    <span className="note-star">
      <Star size={size} className="note-star-empty" aria-hidden />
      {fill > 0 ? (
        <span
          className="note-star-fill"
          style={{ "--star-fill": fill } as CSSProperties}
          aria-hidden
        >
          <Star size={size} className="note-star-on" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

export function RatingStars({
  ratingX10,
  size = 20,
  interactive = false,
  onSelectStar,
}: RatingStarsProps) {
  const summary = ratingX10 === null ? "評価未選択" : `評価 ${ratingX10 / 10}`;

  if (interactive && onSelectStar) {
    return (
      <div className="note-stars" role="radiogroup" aria-label="評価">
        <span className="visually-hidden">{summary}</span>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = starFillAt(ratingX10, star);
          return (
            // biome-ignore lint/a11y/useSemanticElements: 整数ショートカット。native radio は選択済みで change しない
            <button
              key={star}
              type="button"
              role="radio"
              className="note-star-button"
              aria-label={`評価 ${star}`}
              aria-checked={fill > 0}
              onClick={() => onSelectStar(ratingX10FromStar(star))}
            >
              <StarGlyph size={size} fill={fill} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="note-stars">
      <span className="visually-hidden">{summary}</span>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>
          <StarGlyph size={size} fill={starFillAt(ratingX10, star)} />
        </span>
      ))}
    </div>
  );
}
