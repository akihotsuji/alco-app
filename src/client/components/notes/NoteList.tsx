import { LoadMoreSentinel } from "@/client/components/cellar/LoadMoreSentinel.tsx";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { NoteCard } from "@/client/components/notes/NoteCard.tsx";
import { NoteToolbar } from "@/client/components/notes/NoteToolbar.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { useBottle } from "@/client/hooks/use-bottles.ts";
import { useNoteListFilters } from "@/client/hooks/use-note-list-filters.ts";
import { useInfiniteTastingNotes } from "@/client/hooks/use-tasting-notes.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { noteCreateHref } from "@/client/lib/app-routes.ts";
import { isUuid } from "@/client/lib/bottle-form.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { TastingNoteListItem } from "@/shared/tasting-notes.ts";

export function NoteList() {
  const filters = useNoteListFilters();
  const bottleId = filters.bottleId;
  if (bottleId && !isUuid(bottleId)) {
    return <NotFoundPage />;
  }
  return <LoadedNoteList />;
}

function LoadedNoteList() {
  const filters = useNoteListFilters();
  const bottleId = filters.bottleId && isUuid(filters.bottleId) ? filters.bottleId : undefined;
  const bottle = useBottle(bottleId);
  const query = useInfiniteTastingNotes(
    {
      ...(bottleId ? { bottleId } : {}),
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.drinkType ? { drinkType: filters.drinkType } : {}),
      ...(filters.ratingX10Min !== undefined ? { ratingX10Min: filters.ratingX10Min } : {}),
    },
    !bottleId || bottle.isSuccess,
  );

  useSetHeaderOverride({
    title: bottle.data?.name,
  });

  if (
    bottleId &&
    bottle.isError &&
    isApiClientError(bottle.error) &&
    bottle.error.code === "not_found"
  ) {
    return <NotFoundPage />;
  }
  if (query.isError && isApiClientError(query.error) && query.error.code === "not_found") {
    return <NotFoundPage />;
  }

  const items: TastingNoteListItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = query.data?.pages[0]?.totalCount;
  const emptyAll = totalCount === 0;
  const emptyFilter = Boolean(query.data && items.length === 0 && filters.filtered);
  const createTo = noteCreateHref(bottleId);
  const filterEmptyMessage = filters.q
    ? "一致するノートがありません"
    : "該当するノートがありません";

  return (
    <div className="note-list">
      {emptyAll ? null : (
        <>
          {bottleId ? null : <p className="form-lead">香りや味わいを振り返る</p>}
          <NoteToolbar {...filters} />
        </>
      )}
      {query.isPending || (bottleId && bottle.isPending) ? <NoteListSkeleton /> : null}
      {query.isError ? (
        <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : null}
      {emptyAll ? (
        <EmptyState
          pose="default"
          message="テイスティングノートはまだありません"
          detail="気になるお酒の味わいを記録してみましょう"
          actionLabel="ノートを作成"
          actionTo={createTo}
        />
      ) : null}
      {emptyFilter ? (
        <div className="note-filter-empty">
          <p>{filterEmptyMessage}</p>
          <Chip selected={false} onSelect={filters.clearFilters}>
            フィルタを解除
          </Chip>
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="note-card-list skeleton-fade">
          <h2 className="note-list-heading">最近のノート</h2>
          {items.map((item) => (
            <NoteCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
      {query.hasNextPage ? (
        <LoadMoreSentinel
          enabled={query.hasNextPage && !query.isFetchingNextPage}
          onVisible={() => {
            void query.fetchNextPage();
          }}
        />
      ) : null}
    </div>
  );
}

function NoteListSkeleton() {
  return (
    <div className="note-card-list" role="status">
      <span className="visually-hidden">読み込み中</span>
      {["a", "b", "c"].map((key) => (
        <div key={key} className="note-card-skeleton" />
      ))}
    </div>
  );
}
