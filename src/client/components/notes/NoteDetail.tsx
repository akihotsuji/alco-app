import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { RatingStars } from "@/client/components/notes/RatingStars.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { useTastingNote } from "@/client/hooks/use-tasting-notes.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { isUuid } from "@/client/lib/bottle-form.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { formatRatingX10, type TastingNote } from "@/shared/tasting-notes.ts";
import { formatLongJapaneseDate } from "@/shared/tokyo-date.ts";

export function NoteDetail({ noteId }: { noteId: string | undefined }) {
  if (!noteId || !isUuid(noteId)) {
    return <NotFoundPage />;
  }
  return <LoadedNoteDetail noteId={noteId} />;
}

function LoadedNoteDetail({ noteId }: { noteId: string }) {
  const query = useTastingNote(noteId);
  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return isApiClientError(query.error) && query.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
    );
  }
  return <NoteDetailBody note={query.data} />;
}

function NoteDetailBody({ note }: { note: TastingNote }) {
  useSetHeaderOverride({ title: note.drinkName });
  const fields = [
    { label: "外観", value: note.appearance },
    { label: "香り", value: note.aroma },
    { label: "味わい", value: note.taste },
    { label: "余韻", value: note.finish },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
  const firstPhoto = note.photos[0];

  return (
    <article className="note-detail">
      {firstPhoto ? (
        <div className="note-detail-photo">
          <img src={photoContentUrl(firstPhoto.id)} alt="" />
        </div>
      ) : null}
      <div className="note-detail-rating">
        <RatingStars ratingX10={note.ratingX10} size={20} />
        <strong>{formatRatingX10(note.ratingX10)}</strong>
        <span className="note-detail-date">{formatLongJapaneseDate(note.tastedOn)}</span>
      </div>
      {note.bottle ? (
        <Link className="form-row note-bottle-link" to={`/cellar/${note.bottle.id}`}>
          <span className="form-row-label">
            {note.bottle.status === "consumed" ? "貯蔵庫のボトル" : "セラーのボトル"}
          </span>
          <span className="form-row-value">{note.bottle.name}</span>
          <ChevronRight size={20} className="form-row-chevron" aria-hidden />
        </Link>
      ) : null}
      {fields.length === 0 ? (
        <p className="note-detail-empty">まだ書いていません</p>
      ) : (
        <dl className="note-detail-fields">
          {fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
