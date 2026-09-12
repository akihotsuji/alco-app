import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { BottleBatchForm } from "@/client/components/cellar/BottleBatchForm.tsx";
import { BottleConflictDialog } from "@/client/components/cellar/BottleConflictDialog.tsx";
import { BottleDetail } from "@/client/components/cellar/BottleDetail.tsx";
import { BottleFormFields, useBottleFormSubmit } from "@/client/components/cellar/BottleForm.tsx";
import { CellarDestinationField } from "@/client/components/cellar/CellarDestinationField.tsx";
import { CellarList } from "@/client/components/cellar/CellarList.tsx";
import { CellarSwitcher } from "@/client/components/cellar/CellarSwitcher.tsx";
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
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
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
import { newOperationKey, parseConflictBottle } from "@/client/lib/cellar-share.ts";
import { groupBottlesByConsumedMonth } from "@/client/lib/cellar-shelf.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { Bottle, BottleItem } from "@/shared/bottles.ts";
import { formatBottleCount } from "@/shared/bottles.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";

export function CellarPage() {
  return <CellarList />;
}

export function BottleBatchPage() {
  return <BottleBatchForm />;
}

export function ArchivePage() {
  const filters = useBottleListFilters();
  const columns = useShelfColumns();
  const { selected } = useCellarSelection();
  const query = useInfiniteBottles(
    {
      view: "archive",
      limit: 50,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.drinkType ? { drinkType: filters.drinkType } : {}),
      ...(selected?.id ? { cellarId: selected.id } : {}),
    },
    Boolean(selected?.id),
  );
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
      <CellarSwitcher />
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
  const { items, selected } = useCellarSelection();
  const [destinationId, setDestinationId] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BottleFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  useEffect(() => {
    if (!destinationId && selected?.id) {
      setDestinationId(selected.id);
    }
  }, [destinationId, selected?.id]);
  const destination = items.find((item) => item.id === destinationId) ?? selected;

  return (
    <BottleFormFields
      mode="new"
      pending={create.isPending}
      saveState={create.isPending ? "loading" : saveState}
      formError={formError}
      serverErrors={serverErrors}
      header={
        <CellarDestinationField
          items={items}
          valueId={destination?.id}
          disabled={create.isPending}
          onChange={(cellar) => setDestinationId(cellar.id)}
        />
      }
      onClearServer={() => {
        setFormError(null);
        setServerErrors({});
      }}
      onCreate={(body) => {
        if (!body) {
          return;
        }
        if (!destination) {
          setFormError("保存先のセラーを確認してください");
          return;
        }
        setSaveState("loading");
        create.mutate(
          { ...body, cellarId: destination.id, operationKey: newOperationKey() },
          {
            onSuccess: (result) => afterCreate(result.items),
            onError: (error) => {
              const failure = describeBottleSaveFailure(error, navigator.onLine);
              setSaveState("error");
              setFormError(failure.formMessage);
              setServerErrors(failure.fieldErrors);
            },
          },
        );
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
      initialBackPhotoId={query.data.photos[1]?.id ?? null}
    />
  );
}

function LoadedEditBottle({
  bottleId,
  initialPhotoId,
  initialBackPhotoId,
}: {
  bottleId: string;
  initialPhotoId: string | null;
  initialBackPhotoId: string | null;
}) {
  const query = useBottle(bottleId);
  const update = useUpdateBottle();
  const remove = useDeleteBottle();
  const { items } = useCellarSelection();
  useCellarSync(query.data?.cellarId);
  const { afterUpdate, afterDelete } = useBottleFormSubmit();
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<BottleFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [conflict, setConflict] = useState<Bottle | null>(null);
  const [mineSnapshot, setMineSnapshot] = useState<Bottle | null>(null);
  const bottle = query.data;
  if (!bottle) {
    return <DetailSkeleton />;
  }
  const shared = items.find((item) => item.id === bottle.cellarId)?.kind === "shared";

  return (
    <>
      <BottleFormFields
        mode="edit"
        initial={bottleFormStateFromBottle(bottle)}
        existingPhotoId={initialPhotoId}
        existingBackPhotoId={initialBackPhotoId}
        pending={update.isPending}
        deleting={remove.isPending}
        saveState={update.isPending ? "loading" : saveState}
        formError={formError}
        serverErrors={serverErrors}
        header={<CellarDestinationField items={items} valueId={bottle.cellarId} locked />}
        isShared={shared}
        deleteTitle={shared ? `『${bottle.name}』を共有セラーから削除しますか？` : undefined}
        deleteBody={
          shared ? "参加者全員のセラーから消えます。各自の飲酒記録とノートは残ります。" : undefined
        }
        deletePrimaryLabel={shared ? "全員のセラーから削除" : undefined}
        memoLabel={shared ? CELLAR_COPY.sharedMemoLabel : undefined}
        onClearServer={() => {
          setFormError(null);
          setServerErrors({});
        }}
        onUpdate={(body) => {
          if (!body) {
            return;
          }
          setSaveState("loading");
          const nextBody = {
            ...body,
            expectedVersion: bottle.version,
            operationKey: newOperationKey(),
          };
          setMineSnapshot({
            ...bottle,
            ...body,
            photos: bottle.photos,
          });
          update.mutate(
            { id: bottleId, body: nextBody },
            {
              onSuccess: afterUpdate,
              onError: (error) => {
                const current =
                  isApiClientError(error) && error.code === "conflict"
                    ? parseConflictBottle(error.conflict?.current)
                    : null;
                if (current) {
                  setConflict(current);
                  setSaveState("idle");
                  return;
                }
                if (isApiClientError(error) && error.code === "not_found") {
                  setFormError(CELLAR_COPY.conflictDeleted);
                  setSaveState("error");
                  return;
                }
                const failure = describeBottleSaveFailure(error, navigator.onLine);
                setSaveState("error");
                setFormError(failure.formMessage);
                setServerErrors(failure.fieldErrors);
              },
            },
          );
        }}
        onDelete={() => {
          remove.mutate(
            {
              id: bottleId,
              body: { expectedVersion: bottle.version, operationKey: newOperationKey() },
            },
            {
              onSuccess: afterDelete,
              onError: () => {
                setFormError(TOAST_MESSAGES.saveFailed);
              },
            },
          );
        }}
      />
      {conflict && mineSnapshot ? (
        <BottleConflictDialog
          open
          initial={bottle}
          mine={mineSnapshot}
          current={conflict}
          onClose={() => setConflict(null)}
          onApply={(next, photoChoice) => {
            setConflict(null);
            update.mutate(
              {
                id: bottleId,
                body: {
                  name: next.name,
                  drinkType: next.drinkType,
                  producer: next.producer,
                  origin: next.origin,
                  variety: next.variety,
                  vintage: next.vintage,
                  purchasedOn: next.purchasedOn,
                  priceJpy: next.priceJpy,
                  shop: next.shop,
                  storedOn: next.storedOn,
                  storage: next.storage,
                  memo: next.memo,
                  expectedVersion: next.version,
                  operationKey: newOperationKey(),
                  ...(photoChoice === "mine"
                    ? {
                        photoIds: mineSnapshot.photos.map((photo) => photo.id),
                      }
                    : {}),
                },
              },
              { onSuccess: afterUpdate },
            );
          }}
        />
      ) : null}
    </>
  );
}
