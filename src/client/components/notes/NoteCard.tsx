import { ChevronRight, Images } from "lucide-react";
import { Link } from "react-router";
import { DrinkTypeIcon } from "@/client/components/notes/DrinkTypeIcon.tsx";
import { RatingStars } from "@/client/components/notes/RatingStars.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";

function formatNoteDate(date: string): string {
  return date.replaceAll("-", "/");
}

export function NoteCard({ item }: { item: TastingNoteListItem }) {
  return (
    <Link className="note-card" to={`/notes/${item.id}`}>
      {item.thumbPhotoId ? (
        <div className="note-card-photo">
          <ContentPhoto
            src={photoContentUrl(item.thumbPhotoId)}
            size={PHOTO_DISPLAY_SIZE.noteCard}
          />
        </div>
      ) : (
        <div className="note-card-empty">
          <DrinkTypeIcon type={item.drinkType} size={28} />
        </div>
      )}
      <div className="note-card-body">
        <p className="note-card-name">{item.drinkName}</p>
        <p className="note-card-meta">
          <time dateTime={item.tastedOn}>{formatNoteDate(item.tastedOn)}</time>
          <RatingStars ratingX10={item.ratingX10} size={14} />
          <span>{formatRatingX10(item.ratingX10)}</span>
          {item.photoCount >= 2 ? (
            <span className="note-card-photos">
              <Images size={14} aria-hidden />
              {item.photoCount}
            </span>
          ) : null}
        </p>
        {item.taste ? <p className="note-card-taste">{item.taste}</p> : null}
      </div>
      <ChevronRight size={20} className="note-card-chevron" aria-hidden />
    </Link>
  );
}
