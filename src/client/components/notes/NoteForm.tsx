import { Navigate, useSearchParams } from "react-router";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useTastingNote } from "@/client/hooks/use-tasting-notes.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { logCreateHref } from "@/client/lib/app-routes.ts";
import { isUuid } from "@/client/lib/bottle-form.ts";
import { parseFormOrigin } from "@/client/lib/opened-followup.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";

export function NoteNewForm() {
  const [searchParams] = useSearchParams();
  const bottleId = searchParams.get("bottleId");
  const from = parseFormOrigin(searchParams.get("from"));
  return (
    <Navigate
      to={logCreateHref({
        bottleId: bottleId && isUuid(bottleId) ? bottleId : null,
        from,
      })}
      replace
    />
  );
}

export function NoteEditForm({ noteId }: { noteId: string | undefined }) {
  if (!noteId || !isUuid(noteId)) {
    return <NotFoundPage />;
  }
  return <NoteEditRedirect noteId={noteId} />;
}

function NoteEditRedirect({ noteId }: { noteId: string }) {
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
  return <Navigate to={`/logs/entries/${query.data.drinkLog.id}/edit`} replace />;
}
