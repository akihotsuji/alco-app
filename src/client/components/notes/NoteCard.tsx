import { Images } from "lucide-react";
import { Link } from "react-router";
import { DrinkTypeIcon } from "@/client/components/notes/DrinkTypeIcon.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";
import { formatShortMonthDay } from "@/shared/tokyo-date.ts";

export function NoteCard({ item }: { item: TastingNoteListItem }) {
  return (
    <Link className="note-card" to={`/notes/${item.id}`}>
      {item.thumbPhotoId ? (
        <div className="note-card-photo">
          <img src={photoContentUrl(item.thumbPhotoId)} alt="" loading="lazy" />
        </div>
      ) : (
        <div className="note-card-empty">
          <DrinkTypeIcon type={item.drinkType} size={32} />
        </div>
      )}
      <p className="note-card-name">{item.drinkName}</p>
      <p className="note-card-meta">
        <span>
          ★{formatRatingX10(item.ratingX10)} ・ {formatShortMonthDay(item.tastedOn)}
        </span>
        {item.photoCount >= 2 ? (
          <span className="note-card-photos">
            <Images size={14} aria-hidden />
            {item.photoCount}
          </span>
        ) : null}
      </p>
    </Link>
  );
}
