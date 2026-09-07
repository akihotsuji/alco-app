import { useParams } from "react-router";
import { NoteDetail } from "@/client/components/notes/NoteDetail.tsx";
import { NoteEditForm, NoteNewForm } from "@/client/components/notes/NoteForm.tsx";
import { NoteList } from "@/client/components/notes/NoteList.tsx";

export function NotesPage() {
  return <NoteList />;
}

export function NoteDetailPage() {
  const { noteId } = useParams();
  return <NoteDetail noteId={noteId} />;
}

export function NoteFormPage({ mode }: { mode: "new" | "edit" }) {
  const { noteId } = useParams();
  if (mode === "edit") {
    return <NoteEditForm noteId={noteId} />;
  }
  return <NoteNewForm />;
}
