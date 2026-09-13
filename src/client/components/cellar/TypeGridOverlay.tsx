import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { BottleTile } from "@/client/components/cellar/BottleTile.tsx";
import { ShelfSkeleton } from "@/client/components/cellar/Shelf.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useTypeGrid } from "@/client/components/layout/type-grid-context.tsx";
import { useInfiniteBottles, useReorderBottles } from "@/client/hooks/use-bottles.ts";
import { useFocusTrap } from "@/client/hooks/use-focus-trap.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { newOperationKey } from "@/client/lib/cellar-share.ts";
import {
  chunkShelfRows,
  edgeScrollDelta,
  indexFromClientPoint,
  keepsTypeGrid,
  moveItem,
  pointerMovedBeyond,
  sameIdOrder,
  TYPE_GRID_COLUMNS,
  TYPE_GRID_LONG_PRESS_MS,
  TYPE_GRID_PAGE_LIMIT,
} from "@/client/lib/cellar-shelf.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import { cn } from "@/client/lib/utils.ts";
import type { BottleItem } from "@/shared/bottles.ts";
import { BOTTLE_MESSAGES, formatBottleCount } from "@/shared/bottles.ts";
import { DRINK_TYPE_LABELS } from "@/shared/constants.ts";

function flattenPages(pages: { items: BottleItem[] }[] | undefined): BottleItem[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

function saveMessage(error: unknown): string {
  if (!navigator.onLine) {
    return FORM_ERROR_MESSAGES.offline;
  }
  if (isApiClientError(error) && error.conflict?.reason === "set") {
    return BOTTLE_MESSAGES.orderConflict;
  }
  return FORM_ERROR_MESSAGES.generic;
}

export function TypeGridOverlay() {
  const location = useLocation();
  const { open, session, requestClose, registerCloseHandler } = useTypeGrid();
  const visible = open && location.pathname === "/cellar";
  const searchActive = session?.searchActive === true;
  const drinkType = session?.drinkType;
  const cellarId = session?.cellarId;
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();
  const reorder = useReorderBottles();
  const query = useInfiniteBottles(
    {
      view: "cellar",
      limit: TYPE_GRID_PAGE_LIMIT,
      ...(drinkType ? { drinkType } : {}),
      ...(session?.q ? { q: session.q } : {}),
      ...(cellarId ? { cellarId } : {}),
    },
    open && Boolean(drinkType),
  );

  const serverItems = flattenPages(query.data?.pages);
  const serverKey = serverItems.map((item) => item.id).join(",");
  const loadedAll = Boolean(query.data) && !query.hasNextPage && !query.isFetchingNextPage;
  const [items, setItems] = useState<BottleItem[]>([]);
  const [baseline, setBaseline] = useState<BottleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [blockNavigate, setBlockNavigate] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dirty = !searchActive && !sameIdOrder(items, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const searchRef = useRef(searchActive);
  searchRef.current = searchActive;
  const savingRef = useRef(false);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
  } | null>(null);
  const pressRef = useRef<{
    x: number;
    y: number;
    index: number;
    id: string;
    pointerId: number;
    timer: number;
  } | null>(null);
  const flipPrev = useRef(new Map<string, DOMRect>());

  useFocusTrap(visible, dialogRef);

  useEffect(() => {
    if (!open || !query.hasNextPage || query.isFetchingNextPage || query.isError) {
      return;
    }
    void query.fetchNextPage();
  }, [open, query.fetchNextPage, query.hasNextPage, query.isError, query.isFetchingNextPage]);

  useEffect(() => {
    if (!loadedAll || dirtyRef.current) {
      return;
    }
    void serverKey;
    setItems((current) => (sameIdOrder(current, serverItems) ? current : serverItems));
    setBaseline((current) => (sameIdOrder(current, serverItems) ? current : serverItems));
  }, [loadedAll, serverItems, serverKey]);

  const persist = useCallback(async (): Promise<boolean> => {
    if (searchRef.current || !dirtyRef.current) {
      return true;
    }
    if (savingRef.current) {
      return false;
    }
    const drink = session?.drinkType;
    if (!drink) {
      return true;
    }
    const bottleIds = itemsRef.current.map((item) => item.id);
    if (bottleIds.length === 0) {
      return true;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await reorder.mutateAsync({
        drinkType: drink,
        bottleIds,
        ...(session?.cellarId ? { cellarId: session.cellarId } : {}),
        operationKey: newOperationKey(),
      });
      setBaseline(itemsRef.current);
      return true;
    } catch (error) {
      showToast({ message: saveMessage(error) });
      if (isApiClientError(error) && error.conflict?.reason === "set") {
        void query.refetch();
        dirtyRef.current = false;
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [query, reorder, session, showToast]);

  useEffect(() => {
    registerCloseHandler(persist);
    return () => registerCloseHandler(null);
  }, [persist, registerCloseHandler]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (keepsTypeGrid(location.pathname)) {
      return;
    }
    requestClose();
  }, [location.pathname, open, requestClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onHide() {
      if (document.visibilityState === "hidden") {
        void persist();
      }
    }
    function onPageHide() {
      void persist();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [open, persist]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose, visible]);

  const orderKey = items.map((item) => item.id).join(",");
  useLayoutEffect(() => {
    void orderKey;
    const root = gridRef.current;
    if (!root) {
      return;
    }
    const nodes = root.querySelectorAll<HTMLElement>("[data-bottle-id]");
    if (reduceMotion) {
      flipPrev.current.clear();
      for (const node of nodes) {
        const id = node.dataset.bottleId;
        if (id) {
          flipPrev.current.set(id, node.getBoundingClientRect());
        }
      }
      return;
    }
    for (const node of nodes) {
      const id = node.dataset.bottleId;
      if (!id) {
        continue;
      }
      const next = node.getBoundingClientRect();
      const last = flipPrev.current.get(id);
      flipPrev.current.set(id, next);
      if (!last || node.dataset.lifted === "1") {
        continue;
      }
      const dx = last.left - next.left;
      const dy = last.top - next.top;
      if (dx === 0 && dy === 0) {
        continue;
      }
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform var(--dur-state) var(--ease-out)";
        node.style.transform = "";
      });
    }
  }, [orderKey, reduceMotion]);

  const canReorder = loadedAll && !searchActive && !saving && !query.isError;
  const rows = chunkShelfRows(items, TYPE_GRID_COLUMNS);
  const countLabel = formatBottleCount(loadedAll ? items.length : (session?.count ?? items.length));

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press) {
      window.clearTimeout(press.timer);
    }
    pressRef.current = null;
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setLiftedId(null);
    setBlockNavigate(true);
    window.setTimeout(() => setBlockNavigate(false), 400);
  }, []);

  const readRects = useCallback(() => {
    const root = gridRef.current;
    if (!root) {
      return [];
    }
    return [...root.querySelectorAll<HTMLElement>("[data-bottle-id]")].map((node) =>
      node.getBoundingClientRect(),
    );
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && press.pointerId === event.pointerId) {
        if (pointerMovedBeyond(press.x, press.y, event.clientX, event.clientY)) {
          clearPress();
        }
        return;
      }
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const scroller = scrollerRef.current;
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        const delta = edgeScrollDelta(event.clientY, bounds.top, bounds.bottom);
        if (delta !== 0) {
          scroller.scrollTop += delta;
        }
      }
      const nextIndex = indexFromClientPoint(event.clientX, event.clientY, readRects());
      const currentIndex = itemsRef.current.findIndex((item) => item.id === drag.id);
      if (currentIndex < 0 || nextIndex === currentIndex) {
        return;
      }
      setItems((current) => moveItem(current, currentIndex, nextIndex));
    },
    [clearPress, readRects],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && press.pointerId === event.pointerId) {
        clearPress();
      }
      const drag = dragRef.current;
      if (drag && drag.pointerId === event.pointerId) {
        endDrag();
      }
    },
    [clearPress, endDrag],
  );

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  function onCellPointerDown(event: ReactPointerEvent<HTMLElement>, index: number, id: string) {
    if (!canReorder || event.button !== 0) {
      return;
    }
    clearPress();
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    pressRef.current = {
      x: event.clientX,
      y: event.clientY,
      index,
      id,
      pointerId,
      timer: window.setTimeout(() => {
        const press = pressRef.current;
        if (!press || press.id !== id) {
          return;
        }
        pressRef.current = null;
        dragRef.current = { id, pointerId };
        setLiftedId(id);
        haptic("light");
        target.setPointerCapture(pointerId);
      }, TYPE_GRID_LONG_PRESS_MS),
    };
  }

  if (!open || !session || !drinkType) {
    return null;
  }

  return (
    <div
      className={cn("type-grid", !visible && "is-hidden")}
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="type-grid-title"
      aria-hidden={visible ? undefined : true}
    >
      <header className="type-grid-bar">
        <button
          type="button"
          className="header-text-link"
          onClick={() => requestClose()}
          disabled={saving}
        >
          完了
        </button>
        <h2 className="type-grid-title" id="type-grid-title">
          {DRINK_TYPE_LABELS[drinkType]}
          <span className="app-header-muted">{countLabel}</span>
        </h2>
        <span className="type-grid-bar-end" />
      </header>
      <div className="type-grid-body" ref={scrollerRef}>
        {searchActive ? null : <p className="type-grid-hint">長押しして並べ替え</p>}
        {query.isPending || (open && !loadedAll && !query.isError) ? (
          <ShelfSkeleton columns={TYPE_GRID_COLUMNS} rows={2} />
        ) : null}
        {query.isError ? (
          <QueryError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : null}
        {loadedAll && !query.isError ? (
          <div className="type-grid-shelf" ref={gridRef}>
            {rows.map((row, rowIndex) => (
              <div className="type-grid-row" key={row[0]?.id ?? String(rowIndex)}>
                <div className="type-grid-row-items">
                  {row.map((item, indexInRow) => {
                    const index = rowIndex * TYPE_GRID_COLUMNS + indexInRow;
                    const lifted = liftedId === item.id;
                    return (
                      <div
                        className="type-grid-cell"
                        data-bottle-id={item.id}
                        data-lifted={lifted ? "1" : undefined}
                        key={item.id}
                      >
                        <BottleTile
                          item={item}
                          mode="cellar"
                          size="type"
                          preventNavigate={blockNavigate || lifted}
                          suppressNativePress
                          onPointerDown={(event) => onCellPointerDown(event, index, item.id)}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="shelf-board" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
