import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { BottleDetail } from "@/client/components/cellar/BottleDetail.tsx";
import { BottleFormFields, useBottleFormSubmit } from "@/client/components/cellar/BottleForm.tsx";
import { Shelf, ShelfSkeleton } from "@/client/components/cellar/Shelf.tsx";
import { useAnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { EmptyState, shouldPlayEmptyEnter } from "@/client/components/feedback/EmptyState.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
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
  useInfiniteBottles,
  useRestoreBottle,
  useUpdateBottle,
} from "@/client/hooks/use-bottles.ts";
import { useDrinkLogsByBottle } from "@/client/hooks/use-drink-logs.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { useShelfColumns } from "@/client/hooks/use-shelf-columns.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  type BottleFormErrors,
  bottleFormStateFromBottle,
  describeBottleSaveFailure,
  isUuid,
} from "@/client/lib/bottle-form.ts";
import {
  groupBottlesByConsumedMonth,
  rankByCreatedAtDesc,
  shelfColumns,
  shelfRowIndex,
} from "@/client/lib/cellar-shelf.ts";
import {
  clearRouterLocationState,
  consumeLeftEvent,
  consumeUndoRequested,
  placedBottleEvent,
  takeRememberedShelfEvent,
} from "@/client/lib/history-state.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import { MOTION_MS, type MotionState } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { cn } from "@/client/lib/utils.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { BottleItem } from "@/shared/bottles.ts";
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

function useBottleListFilters() {
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

  function selectDrinkType(type: DrinkType) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("drinkType", type);
        return next;
      },
      { replace: true },
    );
    setTypeOpen(false);
  }

  return {
    q,
    qInput,
    setQInput,
    searchOpen,
    setSearchOpen,
    typeOpen,
    setTypeOpen,
    drinkType,
    clearFilters,
    clearDrinkType,
    selectDrinkType,
  };
}

function CellarToolbar({
  qInput,
  setQInput,
  searchOpen,
  setSearchOpen,
  typeOpen,
  setTypeOpen,
  drinkType,
  clearDrinkType,
  selectDrinkType,
}: {
  qInput: string;
  setQInput: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  typeOpen: boolean;
  setTypeOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  drinkType: DrinkType | undefined;
  clearDrinkType: () => void;
  selectDrinkType: (type: DrinkType) => void;
}) {
  return (
    <>
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
      {typeOpen ? (
        <div className="chip-row chip-row-wrap">
          {DRINK_TYPES.map((type) => (
            <Chip key={type} selected={drinkType === type} onSelect={() => selectDrinkType(type)}>
              {DRINK_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function CellarPage() {
  const location = useLocation();
  const filters = useBottleListFilters();
  const query = useBottles({
    view: "cellar",
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.drinkType ? { drinkType: filters.drinkType } : {}),
  });
  const columns = useShelfColumns();
  const reduceMotion = useReducedMotion();
  const restore = useRestoreBottle();
  const { showToast } = useToast();
  const rememberedRef = useRef(takeRememberedShelfEvent());
  const left =
    consumeLeftEvent(location.state) ??
    (rememberedRef.current?.kind === "left" ? rememberedRef.current : null);
  const placed =
    placedBottleEvent(location.state) ??
    (rememberedRef.current?.kind === "placed" ? rememberedRef.current : null);
  const showUndo = consumeUndoRequested(location.state) || rememberedRef.current?.kind === "left";
  const [headerSeed, setHeaderSeed] = useState<number | undefined>(undefined);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  const [enterId, setEnterId] = useState<string | null>(null);
  const leavePlayed = useRef(false);
  const placedPlayed = useRef(false);
  const toastPlayed = useRef(false);

  const actualCount = query.data?.totalCount;
  const headerTarget =
    headerSeed !== undefined ? headerSeed : actualCount === undefined ? undefined : actualCount;
  const animatedCount = useAnimatedNumber(headerTarget);

  useSetHeaderOverride({
    titleMuted:
      animatedCount === undefined ? undefined : formatBottleCount(Math.round(animatedCount)),
  });

  useEffect(() => {
    if (actualCount === undefined || !left || leavePlayed.current) {
      return;
    }
    leavePlayed.current = true;
    const items = query.data?.items ?? [];
    const rank = rankByCreatedAtDesc(items, left);
    setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
    if (reduceMotion) {
      setHeaderSeed(undefined);
    } else {
      setHeaderSeed(actualCount + 1);
      const frame = requestAnimationFrame(() => setHeaderSeed(undefined));
      const clearHighlight = window.setTimeout(() => setHighlightRow(null), MOTION_MS.open);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(clearHighlight);
      };
    }
    const clearHighlight = window.setTimeout(() => setHighlightRow(null), MOTION_MS.open);
    return () => window.clearTimeout(clearHighlight);
  }, [actualCount, left, query.data?.items, reduceMotion]);

  useEffect(() => {
    if (!placed || !query.data || placedPlayed.current) {
      return;
    }
    placedPlayed.current = true;
    const rank = rankByCreatedAtDesc(query.data.items, placed);
    setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
    const clearHighlight = window.setTimeout(() => setHighlightRow(null), MOTION_MS.open);
    return () => window.clearTimeout(clearHighlight);
  }, [placed, query.data]);

  useEffect(() => {
    if (!showUndo || !left || toastPlayed.current) {
      return;
    }
    toastPlayed.current = true;
    clearRouterLocationState();
    rememberedRef.current = null;
    showToast({
      message: TOAST_MESSAGES.opened,
      action: {
        label: "取り消す",
        onSelect: () => {
          restore.mutate(left.bottleId, {
            onSuccess: () => {
              setEnterId(left.bottleId);
              const items = query.data?.items ?? [];
              const rank = rankByCreatedAtDesc(items, left);
              setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
              window.setTimeout(() => {
                setHighlightRow(null);
                setEnterId(null);
              }, MOTION_MS.open);
              showToast({ message: TOAST_MESSAGES.undone, cheer: true });
            },
            onError: () => {
              showToast({
                message: navigator.onLine
                  ? FORM_ERROR_MESSAGES.generic
                  : FORM_ERROR_MESSAGES.offline,
              });
              void query.refetch();
            },
          });
        },
      },
    });
  }, [left, query, restore, showToast, showUndo]);

  const filteredOut = Boolean(filters.q || filters.drinkType);
  const emptyInventory = query.data?.totalCount === 0;
  const emptyFilter = Boolean(query.data && query.data.items.length === 0 && filteredOut);
  const enterRef = useRef<boolean | null>(null);
  if (enterRef.current === null) {
    enterRef.current = shouldPlayEmptyEnter("cellar:empty");
  }

  return (
    <div className="cellar-list">
      {emptyInventory ? null : <CellarToolbar {...filters} />}
      {query.isPending ? <ShelfSkeleton columns={columns} /> : null}
      {query.isError ? (
        <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : null}
      {emptyInventory ? (
        <div className="cellar-empty" data-enter={enterRef.current ? "1" : undefined}>
          <div className="shelf-stage" data-highlight={highlightRow === 0 ? "1" : undefined}>
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
          <div className="shelf-stage" data-highlight={highlightRow === 0 ? "1" : undefined}>
            <div className="shelf-board" />
          </div>
          <p>該当するボトルがありません</p>
          <Chip selected={false} onSelect={filters.clearFilters}>
            フィルタを解除
          </Chip>
        </div>
      ) : null}
      {query.data && query.data.items.length > 0 ? (
        <Shelf
          items={query.data.items}
          columns={columns}
          mode="cellar"
          highlightRow={highlightRow}
          enterId={enterId}
        />
      ) : null}
    </div>
  );
}

function ArchiveSentinel({ enabled, onVisible }: { enabled: boolean; onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        onVisible();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onVisible]);
  return <div ref={ref} className="cellar-archive-sentinel" />;
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
      {emptyInventory ? null : <CellarToolbar {...filters} />}
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
        <ArchiveSentinel
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
