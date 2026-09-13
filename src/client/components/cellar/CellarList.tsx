import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { CellarSwitcher } from "@/client/components/cellar/CellarSwitcher.tsx";
import { CellarToolbar } from "@/client/components/cellar/CellarToolbar.tsx";
import { LoadMoreSentinel } from "@/client/components/cellar/LoadMoreSentinel.tsx";
import { Shelf, ShelfSkeleton, TypeShelfHeading } from "@/client/components/cellar/Shelf.tsx";
import { useAnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { shouldPlayEmptyEnter } from "@/client/components/feedback/EmptyState.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { useTypeGrid } from "@/client/components/layout/type-grid-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { useBottleListFilters } from "@/client/hooks/use-bottle-list-filters.ts";
import {
  getBottle,
  restoreBottle,
  useBottles,
  useInfiniteBottles,
} from "@/client/hooks/use-bottles.ts";
import { useCellarListView } from "@/client/hooks/use-cellar-list-view.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { useShelfColumns } from "@/client/hooks/use-shelf-columns.ts";
import { newOperationKey } from "@/client/lib/cellar-share.ts";
import {
  rankByCreatedAtDesc,
  SHELF_TYPE_PAGE_LIMIT,
  shelfColumns,
  shelfPageLimit,
  shelfRowIndex,
  visibleDrinkTypes,
} from "@/client/lib/cellar-shelf.ts";
import {
  captureCellarVisit,
  clearRouterLocationState,
  consumeLeftEvent,
  currentCellarVisit,
  isCellarListPath,
  markCellarVisitLeavePlayed,
  markCellarVisitPlacedPlayed,
  markCellarVisitToastShown,
  placedBottleEvent,
  releaseCellarVisit,
  takeRememberedIntoVisit,
  takeRememberedShelfEvent,
} from "@/client/lib/history-state.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { cn } from "@/client/lib/utils.ts";
import type { BottleItem, CountsByType } from "@/shared/bottles.ts";
import { formatBottleCount } from "@/shared/bottles.ts";
import { DRINK_TYPE_LABELS, type DrinkType } from "@/shared/constants.ts";

function flattenPages(pages: { items: BottleItem[] }[] | undefined): BottleItem[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

function TypeShelfRow({
  drinkType,
  count,
  q,
  highlight,
  enterId,
  cellarId,
}: {
  drinkType: DrinkType;
  count: number;
  q?: string;
  highlight: boolean;
  enterId: string | null;
  cellarId?: string;
}) {
  const typeGrid = useTypeGrid();
  const label = `${DRINK_TYPE_LABELS[drinkType]} ${formatBottleCount(count)}`;
  const openType = () =>
    typeGrid.openGrid({
      drinkType,
      count,
      searchActive: Boolean(q),
      ...(q ? { q } : {}),
      ...(cellarId ? { cellarId } : {}),
    });
  const query = useInfiniteBottles({
    view: "cellar",
    drinkType,
    limit: SHELF_TYPE_PAGE_LIMIT,
    ...(q ? { q } : {}),
    ...(cellarId ? { cellarId } : {}),
  });
  const items = flattenPages(query.data?.pages);
  if (query.isPending) {
    return (
      <section className="shelf-type" aria-busy>
        <TypeShelfHeading label={label} onOpen={openType} />
        <div className="shelf-type-scroll">
          <div className="shelf-board" />
        </div>
      </section>
    );
  }
  if (query.isError || items.length === 0) {
    return null;
  }
  return (
    <Shelf
      items={items}
      columns={items.length}
      mode="cellar"
      layout="type"
      ghostLabel={label}
      highlightRow={highlight ? 0 : null}
      enterId={enterId}
      canLoadMore={Boolean(query.hasNextPage && !query.isFetchingNextPage)}
      onLoadMore={() => {
        void query.fetchNextPage();
      }}
      onOpenType={openType}
    />
  );
}

export function CellarList() {
  const location = useLocation();
  const filters = useBottleListFilters();
  const { view, setView } = useCellarListView();
  const columns = useShelfColumns();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const guide = useFirstRunGuide();
  const [showCellarHint] = useState(() => !guide.cellarHintSeen);
  const locLeft = consumeLeftEvent(location.state);
  const locPlaced = placedBottleEvent(location.state);
  if (locLeft) {
    captureCellarVisit({ kind: "left", ...locLeft });
  } else if (locPlaced) {
    captureCellarVisit({ kind: "placed", ...locPlaced });
  }
  const [storageTick, setStorageTick] = useState(0);
  const visit = currentCellarVisit();
  void storageTick;
  const left = visit?.event.kind === "left" ? visit.event : null;
  const placed = visit?.event.kind === "placed" ? visit.event : null;
  const showUndo = visit?.event.kind === "left";
  const [headerSeed, setHeaderSeed] = useState<number | undefined>(undefined);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  const [highlightType, setHighlightType] = useState<DrinkType | null>(null);
  const [enterId, setEnterId] = useState<string | null>(null);

  const { selected } = useCellarSelection();
  const cellarId = selected?.id;
  const bottlesReady = Boolean(cellarId);
  const pageLimit = shelfPageLimit(columns);
  const oneQuery = useInfiniteBottles(
    {
      view: "cellar",
      limit: pageLimit,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.drinkType ? { drinkType: filters.drinkType } : {}),
      ...(cellarId ? { cellarId } : {}),
    },
    view === "one" && bottlesReady,
  );
  const typeMeta = useBottles(
    {
      view: "cellar",
      limit: 1,
      ...(filters.q ? { q: filters.q } : {}),
      ...(cellarId ? { cellarId } : {}),
    },
    view === "type" && bottlesReady,
  );

  const oneItems = flattenPages(oneQuery.data?.pages);
  const oneTotal = oneQuery.data?.pages[0]?.totalCount;
  const typeTotal = typeMeta.data?.totalCount;
  const countsByType: CountsByType | undefined =
    view === "type" ? typeMeta.data?.countsByType : oneQuery.data?.pages[0]?.countsByType;
  const actualCount = view === "type" ? typeTotal : oneTotal;
  const headerTarget =
    headerSeed !== undefined ? headerSeed : actualCount === undefined ? undefined : actualCount;
  const animatedCount = useAnimatedNumber(headerTarget);
  const pending = view === "type" ? typeMeta.isPending : oneQuery.isPending;
  const errored = view === "type" ? typeMeta.isError : oneQuery.isError;
  const refetch = view === "type" ? typeMeta.refetch : oneQuery.refetch;
  const fetching = view === "type" ? typeMeta.isFetching : oneQuery.isFetching;
  const filteredOut = Boolean(filters.q || (view === "one" && filters.drinkType));
  const emptyInventory = actualCount === 0;
  useEffect(() => {
    if (emptyInventory && !guide.cellarHintSeen) {
      guide.markHintSeen("cellarHintSeen");
    }
  }, [emptyInventory, guide]);
  const emptyFilter = Boolean(
    actualCount !== undefined &&
      actualCount > 0 &&
      filteredOut &&
      (view === "type" ? typeMeta.data?.items.length === 0 : oneItems.length === 0),
  );
  const enterRef = useRef<boolean | null>(null);
  if (enterRef.current === null) {
    enterRef.current = shouldPlayEmptyEnter("cellar:empty");
  }

  useSetHeaderOverride({
    titleMuted:
      animatedCount === undefined ? undefined : formatBottleCount(Math.round(animatedCount)),
  });

  useEffect(() => {
    if (currentCellarVisit()) {
      takeRememberedShelfEvent();
    } else if (takeRememberedIntoVisit()) {
      setStorageTick((tick) => tick + 1);
    }
    return () => {
      queueMicrotask(() => {
        if (!isCellarListPath(window.location.pathname)) {
          releaseCellarVisit();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (actualCount === undefined || !left || currentCellarVisit()?.leavePlayed) {
      return;
    }
    markCellarVisitLeavePlayed();
    if (view === "type") {
      setHighlightType(left.drinkType ?? null);
    } else {
      const rank = rankByCreatedAtDesc(oneItems, left);
      setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
    }
    if (reduceMotion) {
      setHeaderSeed(undefined);
    } else {
      setHeaderSeed(actualCount + 1);
      const frame = requestAnimationFrame(() => setHeaderSeed(undefined));
      const clearHighlight = window.setTimeout(() => {
        setHighlightRow(null);
        setHighlightType(null);
      }, MOTION_MS.open);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(clearHighlight);
      };
    }
    const clearHighlight = window.setTimeout(() => {
      setHighlightRow(null);
      setHighlightType(null);
    }, MOTION_MS.open);
    return () => window.clearTimeout(clearHighlight);
  }, [actualCount, left, oneItems, reduceMotion, view]);

  useEffect(() => {
    const sourceItems = view === "type" ? (typeMeta.data?.items ?? []) : oneItems;
    if (!placed || (view === "type" ? !typeMeta.data : !oneQuery.data)) {
      return;
    }
    if (currentCellarVisit()?.placedPlayed) {
      return;
    }
    markCellarVisitPlacedPlayed();
    if (view === "type") {
      setHighlightType(
        placed.drinkType ??
          sourceItems.find((item) => item.id === placed.bottleId)?.drinkType ??
          null,
      );
    } else {
      const rank = rankByCreatedAtDesc(oneItems, placed);
      setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
    }
    const clearHighlight = window.setTimeout(() => {
      setHighlightRow(null);
      setHighlightType(null);
    }, MOTION_MS.open);
    return () => window.clearTimeout(clearHighlight);
  }, [oneItems, oneQuery.data, placed, typeMeta.data, view]);

  useEffect(() => {
    const toastShown = currentCellarVisit()?.toastShown ?? false;
    if (!showUndo || !left || toastShown) {
      return;
    }
    markCellarVisitToastShown();
    clearRouterLocationState();
    const bottleId = left.bottleId;
    const createdAt = left.createdAt;
    const drinkType = left.drinkType;
    showToast({
      message: TOAST_MESSAGES.opened,
      action: {
        label: "取り消す",
        onSelect: () => {
          void getBottle(bottleId)
            .then((bottle) =>
              restoreBottle(bottle.id, {
                expectedVersion: bottle.version,
                operationKey: newOperationKey(),
              }),
            )
            .then(
              () => {
                void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
                setEnterId(bottleId);
                if (view === "type") {
                  setHighlightType(drinkType ?? null);
                } else {
                  const rank = rankByCreatedAtDesc(oneItems, { bottleId, createdAt });
                  setHighlightRow(shelfRowIndex(rank, shelfColumns(window.innerWidth)));
                }
                window.setTimeout(() => {
                  setHighlightRow(null);
                  setHighlightType(null);
                  setEnterId(null);
                }, MOTION_MS.open);
                showToast({ message: TOAST_MESSAGES.undone, cheer: true });
              },
              () => {
                showToast({
                  message: navigator.onLine
                    ? FORM_ERROR_MESSAGES.generic
                    : FORM_ERROR_MESSAGES.offline,
                });
                void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
              },
            );
        },
      },
    });
  }, [left, oneItems, queryClient, showToast, showUndo, view]);

  const types = countsByType ? visibleDrinkTypes(countsByType) : [];

  return (
    <div className="cellar-list">
      <CellarSwitcher />
      {emptyInventory ? null : (
        <CellarToolbar
          {...filters}
          listView={view}
          onListViewChange={setView}
          hideTypeFilter={view === "type"}
        />
      )}
      {pending ? <ShelfSkeleton columns={columns} /> : null}
      {errored ? <QueryError onRetry={() => refetch()} retrying={fetching} /> : null}
      {emptyInventory ? (
        <div className="cellar-empty" data-enter={enterRef.current ? "1" : undefined}>
          <div
            className="shelf-stage"
            data-highlight={enterRef.current || highlightRow === 0 ? "1" : undefined}
          >
            <span className="empty-state-mascot">
              <Mascot pose="surprised" size={96} aria-hidden />
            </span>
            <div className="shelf-board" />
          </div>
          <p className="empty-state-message">ボトルはまだありません。撮って 1 本目を並べましょう</p>
          {showCellarHint && !guide.interceptCellarAdd ? (
            <p className="empty-state-detail">持っているボトルを、ここに並べて管理します</p>
          ) : null}
          <Link
            className={cn(buttonVariants(), "empty-action")}
            to="/cellar/new"
            data-guide-target={guide.interceptCellarAdd ? "cellar-add" : undefined}
            onClick={(event) => {
              if (guide.interceptCellarAdd) {
                event.preventDefault();
                guide.onCellarAdd();
              }
            }}
          >
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
      {view === "one" && oneItems.length > 0 ? (
        <>
          <Shelf
            items={oneItems}
            columns={columns}
            mode="cellar"
            highlightRow={highlightRow}
            enterId={enterId}
          />
          {oneQuery.hasNextPage ? (
            <LoadMoreSentinel
              enabled={oneQuery.hasNextPage && !oneQuery.isFetchingNextPage}
              onVisible={() => {
                void oneQuery.fetchNextPage();
              }}
            />
          ) : null}
        </>
      ) : null}
      {view === "type" && !emptyInventory && !emptyFilter && !pending && !errored ? (
        <div className="shelf-by-type">
          {types.map((drinkType) => (
            <TypeShelfRow
              key={drinkType}
              drinkType={drinkType}
              count={countsByType?.[drinkType] ?? 0}
              q={filters.q || undefined}
              highlight={highlightType === drinkType}
              enterId={enterId}
              cellarId={cellarId}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
