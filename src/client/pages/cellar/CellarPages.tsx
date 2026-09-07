import { useState } from "react";
import { useParams } from "react-router";
import { BottleBatchForm } from "@/client/components/cellar/BottleBatchForm.tsx";
import { BottleDetail } from "@/client/components/cellar/BottleDetail.tsx";
import { BottleFormFields, useBottleFormSubmit } from "@/client/components/cellar/BottleForm.tsx";
import { CellarList } from "@/client/components/cellar/CellarList.tsx";
import { CellarToolbar } from "@/client/components/cellar/CellarToolbar.tsx";
import { LoadMoreSentinel } from "@/client/components/cellar/LoadMoreSentinel.tsx";
import { Shelf, ShelfSkeleton } from "@/client/components/cellar/Shelf.tsx";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { useBottleListFilters } from "@/client/hooks/use-bottle-list-filters.ts";
import {
  useBottle,
  useCreateBottles,
  useDeleteBottle,
  useInfiniteBottles,
  useUpdateBottle,
} from "@/client/hooks/use-bottles.ts";
import { useDrinkLogsByBottle } from "@/client/hooks/use-drink-logs.ts";
import { useShelfColumns } from "@/client/hooks/use-shelf-columns.ts";
import { useTastingNotesByBottle } from "@/client/hooks/use-tasting-notes.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  type BottleFormErrors,
  bottleFormStateFromBottle,
  describeBottleSaveFailure,
  isUuid,
} from "@/client/lib/bottle-form.ts";
import { groupBottlesByConsumedMonth } from "@/client/lib/cellar-shelf.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { BottleItem } from "@/shared/bottles.ts";
import { formatBottleCount } from "@/shared/bottles.ts";

export function CellarPage() {
  return <CellarList />;
}

export function BottleBatchPage() {
  return <BottleBatchForm />;
}

export function ArchivePage() {
  const filters = useBottleListFilters();
  const columns = useShelfColumns();
  const query = useInfiniteBottles({
    view: "archive",
    limit: 50,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.drinkType ? { drinkType: filters.drinkType } : {}),
  });
  const items: BottleItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = query.data?.pages[0]?.totalCount;
  const filteredOut = Boolean(filters.q || filters.drinkType);
  const emptyInventory = totalCount === 0;
  const emptyFilter = Boolean(query.data && items.length === 0 && filteredOut);
  const groups = groupBottlesByConsumedMonth(items);

  useSetHeaderOverride({
    titleMuted: totalCount === undefined ? undefined : formatBottleCount(totalCount),
  });

  return (
    <div className="cellar-list">
      {emptyInventory ? null : (
        <CellarToolbar
          {...filters}
          listView="one"
          onListViewChange={() => undefined}
          hideViewToggle
        />
      )}
      {query.isPending ? <ShelfSkeleton columns={columns} /> : null}
      {query.isError ? (
        <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : null}
      {emptyInventory ? (
        <EmptyState pose="default" message="開栓したボトルはここに並びます" />
      ) : null}
      {emptyFilter ? (
        <div className="cellar-filter-empty">
          <div className="shelf-stage">
            <div className="shelf-board" />
          </div>
          <p>該当するボトルがありません</p>
          <Chip selected={false} onSelect={filters.clearFilters}>
            フィルタを解除
          </Chip>
        </div>
      ) : null}
      {groups.map((group) => (
        <section className="cellar-month" key={group.monthKey}>
          <h2 className="cellar-month-title">{group.label}</h2>
          <Shelf items={group.items} columns={columns} mode="archived" />
        </section>
      ))}
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

export function BottleDetailPage() {
  const { bottleId } = useParams();
  if (!bottleId || !isUuid(bottleId)) {
    return <NotFoundPage />;
  }
  return <LoadedBottleDetail bottleId={bottleId} />;
}

function LoadedBottleDetail({ bottleId }: { bottleId: string }) {
  const query = useBottle(bottleId);
  const logs = useDrinkLogsByBottle(bottleId);
  const notes = useTastingNotesByBottle(bottleId);
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
  return (
    <BottleDetail
      bottle={query.data}
      logs={logs.data?.items ?? []}
      notes={notes.data?.items ?? []}
      notesTotalCount={notes.data?.totalCount ?? 0}
    />
  );
}

export function BottleFormPage({ mode }: { mode: "new" | "edit" }) {
  const { bottleId } = useParams();
  if (mode === "edit") {
    if (!bottleId || !isUuid(bottleId)) {
      return <NotFoundPage />;
    }
    return <EditBottlePage bottleId={bottleId} />;
  }
  return <NewBottlePage />;
}

function NewBottlePage() {
  const create = useCreateBottles();
  const { afterCreate } = useBottleFormSubmit();
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BottleFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");

  return (
    <BottleFormFields
      mode="new"
      pending={create.isPending}
      saveState={create.isPending ? "loading" : saveState}
      formError={formError}
      serverErrors={serverErrors}
      onClearServer={() => {
        setFormError(null);
        setServerErrors({});
      }}
      onCreate={(body) => {
        if (!body) {
          return;
        }
        setSaveState("loading");
        create.mutate(body, {
          onSuccess: (result) => afterCreate(result.items),
          onError: (error) => {
            const failure = describeBottleSaveFailure(error, navigator.onLine);
            setSaveState("error");
            setFormError(failure.formMessage);
            setServerErrors(failure.fieldErrors);
          },
        });
      }}
    />
  );
}

function EditBottlePage({ bottleId }: { bottleId: string }) {
  const query = useBottle(bottleId);
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
  return (
    <LoadedEditBottle
      key={query.data.id}
      bottleId={bottleId}
      initialPhotoId={query.data.photos[0]?.id ?? null}
    />
  );
}

function LoadedEditBottle({
  bottleId,
  initialPhotoId,
}: {
  bottleId: string;
  initialPhotoId: string | null;
}) {
  const query = useBottle(bottleId);
  const update = useUpdateBottle();
  const remove = useDeleteBottle();
  const { afterUpdate, afterDelete } = useBottleFormSubmit();
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BottleFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const bottle = query.data;
  if (!bottle) {
    return <DetailSkeleton />;
  }

  return (
    <BottleFormFields
      mode="edit"
      initial={bottleFormStateFromBottle(bottle)}
      existingPhotoId={initialPhotoId}
      pending={update.isPending}
      deleting={remove.isPending}
      saveState={update.isPending ? "loading" : saveState}
      formError={formError}
      serverErrors={serverErrors}
      onClearServer={() => {
        setFormError(null);
        setServerErrors({});
      }}
      onUpdate={(body) => {
        if (!body) {
          return;
        }
        setSaveState("loading");
        update.mutate(
          { id: bottleId, body },
          {
            onSuccess: afterUpdate,
            onError: (error) => {
              const failure = describeBottleSaveFailure(error, navigator.onLine);
              setSaveState("error");
              setFormError(failure.formMessage);
              setServerErrors(failure.fieldErrors);
            },
          },
        );
      }}
      onDelete={() => {
        remove.mutate(bottleId, {
          onSuccess: afterDelete,
          onError: () => {
            setFormError(TOAST_MESSAGES.saveFailed);
          },
        });
      }}
    />
  );
}
