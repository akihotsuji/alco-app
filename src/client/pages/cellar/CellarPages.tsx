import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { BottleDetail } from "@/client/components/cellar/BottleDetail.tsx";
import { BottleFormFields, useBottleFormSubmit } from "@/client/components/cellar/BottleForm.tsx";
import { EmptyState, shouldPlayEmptyEnter } from "@/client/components/feedback/EmptyState.tsx";
import { DetailSkeleton, ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import {
  useBottle,
  useBottles,
  useCreateBottles,
  useDeleteBottle,
  useUpdateBottle,
} from "@/client/hooks/use-bottles.ts";
import { useDrinkLogsByBottle } from "@/client/hooks/use-drink-logs.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  type BottleFormErrors,
  bottleFormStateFromBottle,
  describeBottleSaveFailure,
  isUuid,
  vintageLabel,
} from "@/client/lib/bottle-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { cn } from "@/client/lib/utils.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { formatBottleCount } from "@/shared/bottles.ts";
import { DRINK_TYPE_LABELS, DRINK_TYPES, type DrinkType } from "@/shared/constants.ts";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function CellarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const drinkTypeParam = searchParams.get("drinkType");
  const drinkType =
    drinkTypeParam && (DRINK_TYPES as readonly string[]).includes(drinkTypeParam)
      ? (drinkTypeParam as DrinkType)
      : undefined;
  const [qInput, setQInput] = useState(qParam);
  const [searchOpen, setSearchOpen] = useState(qParam.length > 0);
  const [typeOpen, setTypeOpen] = useState(false);
  const q = useDebounced(qInput.trim(), 300);
  const query = useBottles({
    view: "cellar",
    ...(q ? { q } : {}),
    ...(drinkType ? { drinkType } : {}),
  });

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (q) {
          next.set("q", q);
        } else {
          next.delete("q");
        }
        return next;
      },
      { replace: true },
    );
  }, [q, setSearchParams]);

  useSetHeaderOverride({
    titleMuted: query.data ? formatBottleCount(query.data.totalCount) : undefined,
  });

  const filteredOut = Boolean(q || drinkType);
  const emptyInventory = query.data?.totalCount === 0;
  const emptyFilter = Boolean(query.data && query.data.items.length === 0 && filteredOut);
  const enterRef = useRef<boolean | null>(null);
  if (enterRef.current === null) {
    enterRef.current = shouldPlayEmptyEnter("cellar:empty");
  }

  function clearFilters() {
    setQInput("");
    setSearchOpen(false);
    setTypeOpen(false);
    setSearchParams({}, { replace: true });
  }

  function clearDrinkType() {
    setTypeOpen(false);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("drinkType");
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="cellar-list">
      {emptyInventory ? null : (
        <div className="cellar-toolbar">
          {searchOpen ? (
            <Input
              aria-label="検索"
              value={qInput}
              maxLength={100}
              placeholder="銘柄名・生産者"
              onChange={(event) => setQInput(event.target.value)}
            />
          ) : (
            <Chip selected={false} onSelect={() => setSearchOpen(true)}>
              検索
            </Chip>
          )}
          {drinkType ? (
            <Chip selected onSelect={clearDrinkType}>
              {DRINK_TYPE_LABELS[drinkType]} ×
            </Chip>
          ) : (
            <Chip selected={typeOpen} onSelect={() => setTypeOpen((current) => !current)}>
              種類 ▼
            </Chip>
          )}
        </div>
      )}
      {typeOpen ? (
        <div className="chip-row chip-row-wrap">
          {DRINK_TYPES.map((type) => (
            <Chip
              key={type}
              selected={drinkType === type}
              onSelect={() => {
                setSearchParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.set("drinkType", type);
                    return next;
                  },
                  { replace: true },
                );
                setTypeOpen(false);
              }}
            >
              {DRINK_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      ) : null}
      {query.isPending ? <ListSkeleton count={4} /> : null}
      {query.isError ? (
        <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : null}
      {emptyInventory ? (
        <div className="cellar-empty" data-enter={enterRef.current ? "1" : undefined}>
          <div className="shelf-stage">
            <span className="empty-state-mascot">
              <Mascot pose="surprised" size={96} aria-hidden />
            </span>
            <div className="shelf-board" />
          </div>
          <p className="empty-state-message">ボトルはまだありません。撮って 1 本目を並べましょう</p>
          <Link className={cn(buttonVariants(), "empty-action")} to="/cellar/new?camera=1">
            ボトルを追加
          </Link>
        </div>
      ) : null}
      {emptyFilter ? (
        <div className="cellar-filter-empty">
          <div className="shelf-stage">
            <div className="shelf-board" />
          </div>
          <p>該当するボトルがありません</p>
          <Chip selected={false} onSelect={clearFilters}>
            フィルタを解除
          </Chip>
        </div>
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <ul className="cellar-temp-list">
          {query.data.items.map((item) => (
            <li key={item.id}>
              <Link className="cellar-temp-row" to={`/cellar/${item.id}`}>
                {item.thumbPhotoId ? (
                  <img
                    className="cellar-temp-thumb"
                    src={photoContentUrl(item.thumbPhotoId)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="cellar-temp-thumb is-empty" aria-hidden />
                )}
                <span className="cellar-temp-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {DRINK_TYPE_LABELS[item.drinkType]} ・ {vintageLabel(item.vintage)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ArchivePage() {
  return <EmptyState pose="default" message="開栓したボトルはここに並びます" />;
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
  return <BottleDetail bottle={query.data} logs={logs.data?.items ?? []} />;
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
