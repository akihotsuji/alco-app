import { Link } from "react-router";
import { notesListHref } from "@/client/lib/app-routes.ts";
import { bottleNoteRowText, bottleNotesAllLabel } from "@/client/lib/bottle-notes.ts";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";

type BottleNotesSectionProps = {
  bottleId: string;
  notes: readonly TastingNoteListItem[];
  totalCount: number;
  shared?: boolean;
};

export function BottleNotesSection({
  bottleId,
  notes,
  totalCount,
  shared = false,
}: BottleNotesSectionProps) {
  return (
    <section className="bottle-section">
      <div className="bottle-section-head">
        <h2 className="bottle-section-title">{shared ? "自分のノート" : "ノート"}</h2>
      </div>
      {notes.length > 0 ? (
        <ul className="bottle-log-list">
          {notes.map((note) => (
            <li key={note.id}>
              <Link className="bottle-log-row" to={`/notes/${note.id}`}>
                <span>{bottleNoteRowText(note.tastedOn, note.ratingX10)}</span>
                <span aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {totalCount > 0 ? (
        <Link className="bottle-log-row" to={notesListHref(bottleId)}>
          <span>{bottleNotesAllLabel(totalCount)}</span>
          <span aria-hidden>›</span>
        </Link>
      ) : null}
    </section>
  );
}
