import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { BottleTile } from "@/client/components/cellar/BottleTile.tsx";
import { ShelfSkeleton } from "@/client/components/cellar/Shelf.tsx";
import { TypeGridDragPreview } from "@/client/components/cellar/TypeGridDragPreview.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { useTypeGrid } from "@/client/components/layout/type-grid-context.tsx";
import { useInfiniteBottles, useReorderBottles } from "@/client/hooks/use-bottles.ts";
import { useFocusTrap } from "@/client/hooks/use-focus-trap.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { useTypeGridDrag } from "@/client/hooks/use-type-grid-drag.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { newOperationKey } from "@/client/lib/cellar-share.ts";
import {
  keepsTypeGrid,
  sameIdOrder,
  TYPE_GRID_COLUMNS,
  TYPE_GRID_PAGE_LIMIT,
} from "@/client/lib/cellar-shelf.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import {
  applyItemsOrder,
  canStartTypeGridReorder,
  idSetKey,
  mergeExternalBottleSet,
  moveSelectedId,
  nextSaveAttempt,
  saveSuccessMatchesCurrent,
  shouldAcceptServerOrder,
  type TypeGridSavePhase,
  type TypeGridSaveSnapshot,
  typeGridBoardRow,
  typeGridCellPlacement,
  typeGridLiveMessage,
  typeGridRowCount,
} from "@/client/lib/type-grid-drag.ts";
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
  const followRef = useRef<HTMLDivElement>(null);
  const assistLaunchRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();
  const { setGuard } = useLeaveGuard();
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
  const [savePhase, setSavePhase] = useState<TypeGridSavePhase>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [assistActive, setAssistActive] = useState(false);
  const [assistId, setAssistId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const dirty = !searchActive && !sameIdOrder(items, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const searchRef = useRef(searchActive);
  searchRef.current = searchActive;
  const savePhaseRef = useRef(savePhase);
  savePhaseRef.current = savePhase;
  const lastAttemptRef = useRef<TypeGridSaveSnapshot | null>(null);
  const persistRef = useRef<() => Promise<boolean>>(async () => true);

  useFocusTrap(visible, dialogRef);

  const announce = useCallback((message: string) => {
    setLiveMessage(message);
  }, []);

  const listReady = canStartTypeGridReorder({
    loadedAll,
    searchActive,
    saving: savePhase === "saving" || savePhase === "conflict",
    fetchError: query.isError,
    count: items.length,
    phase: "idle",
  });

  const drag = useTypeGridDrag({
    enabled: listReady,
    items,
    itemsRef,
    setItems,
    scrollerRef,
    gridRef,
    followRef,
    reduceMotion,
    visible,
    announce,
  });

  const canReorder = canStartTypeGridReorder({
    loadedAll,
    searchActive,
    saving: savePhase === "saving" || savePhase === "conflict",
    fetchError: query.isError,
    count: items.length,
    phase: drag.phase,
  });

  useEffect(() => {
    if (!open || !query.hasNextPage || query.isFetchingNextPage || query.isError) {
      return;
    }
    void query.fetchNextPage();
  }, [open, query.fetchNextPage, query.hasNextPage, query.isError, query.isFetchingNextPage]);

  useEffect(() => {
    void serverKey;
    if (!loadedAll) {
      return;
    }
    if (
      shouldAcceptServerOrder({
        phase: drag.phase,
        savePhase: savePhaseRef.current,
        dirty: dirtyRef.current,
      })
    ) {
      setItems((current) => (sameIdOrder(current, serverItems) ? current : serverItems));
      setBaseline((current) => (sameIdOrder(current, serverItems) ? current : serverItems));
      return;
    }
    if (idSetKey(serverItems) !== idSetKey(itemsRef.current)) {
      setItems((current) => mergeExternalBottleSet(current, serverItems));
      setBaseline((current) => mergeExternalBottleSet(current, serverItems));
    }
  }, [drag.phase, loadedAll, serverItems, serverKey]);

  const recoverFromConflict = useCallback(async (): Promise<boolean> => {
    setSavePhase("conflict");
    try {
      const result = await query.refetch();
      if (result.error || !result.data) {
        setSaveError(BOTTLE_MESSAGES.orderConflict);
        return false;
      }
      const next = flattenPages(result.data.pages);
      setItems(next);
      setBaseline(next);
      dirtyRef.current = false;
      lastAttemptRef.current = null;
      setSavePhase("idle");
      setSaveError(null);
      return false;
    } catch {
      setSaveError(BOTTLE_MESSAGES.orderConflict);
      return false;
    }
  }, [query]);

  const persist = useCallback(async (): Promise<boolean> => {
    drag.abortForClose();
    if (searchRef.current || !dirtyRef.current) {
      return true;
    }
    if (savePhaseRef.current === "saving") {
      return false;
    }
    if (savePhaseRef.current === "conflict") {
      return recoverFromConflict();
    }
    const drink = session?.drinkType;
    if (!drink) {
      return true;
    }
    const bottleIds = itemsRef.current.map((item) => item.id);
    if (bottleIds.length === 0) {
      return true;
    }
    const snapshot = nextSaveAttempt({
      currentIds: bottleIds,
      lastAttempt: lastAttemptRef.current,
      newKey: newOperationKey,
      drinkType: drink,
      ...(session?.cellarId ? { cellarId: session.cellarId } : {}),
    });
    lastAttemptRef.current = snapshot;
    savePhaseRef.current = "saving";
    setSavePhase("saving");
    setSaveError(null);
    try {
      await reorder.mutateAsync({
        drinkType: drink,
        bottleIds: snapshot.bottleIds,
        ...(snapshot.cellarId ? { cellarId: snapshot.cellarId } : {}),
        operationKey: snapshot.operationKey,
      });
      if (
        saveSuccessMatchesCurrent(
          snapshot.bottleIds,
          itemsRef.current.map((item) => item.id),
        )
      ) {
        setBaseline(applyItemsOrder(itemsRef.current, snapshot.bottleIds));
        dirtyRef.current = false;
      }
      lastAttemptRef.current = null;
      savePhaseRef.current = "idle";
      setSavePhase("idle");
      return true;
    } catch (error) {
      const message = saveMessage(error);
      setSaveError(message);
      showToast({ message });
      if (
        isApiClientError(error) &&
        (error.code === "not_found" || error.conflict?.reason === "set")
      ) {
        return recoverFromConflict();
      }
      savePhaseRef.current = "failed";
      setSavePhase("failed");
      return false;
    }
  }, [drag, recoverFromConflict, reorder, session, showToast]);

  persistRef.current = persist;

  useEffect(() => {
    registerCloseHandler(() => persistRef.current());
    return () => registerCloseHandler(null);
  }, [registerCloseHandler]);

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
        drag.cancelActiveGesture();
        void persistRef.current();
      }
    }
    function onPageHide() {
      drag.cancelActiveGesture();
      void persistRef.current();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [drag, open]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (drag.phase === "press" || drag.phase === "drag" || drag.phase === "scroll") {
        event.preventDefault();
        event.stopPropagation();
        drag.cancelActiveGesture();
        return;
      }
      if (drag.phase === "settling") {
        event.preventDefault();
        event.stopPropagation();
        drag.completeSettlingNow();
        return;
      }
      if (assistActive) {
        event.preventDefault();
        event.stopPropagation();
        setAssistActive(false);
        setAssistId(null);
        assistLaunchRef.current?.focus();
        return;
      }
      event.preventDefault();
      requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assistActive, drag, requestClose, visible]);

  useEffect(() => {
    const busy = dirty || drag.phase !== "idle" || savePhase === "saving";
    if (!busy) {
      setGuard(null);
      return;
    }
    setGuard((proceed) => {
      void persistRef.current().then((ok) => {
        if (ok) {
          proceed();
        }
      });
    });
    return () => setGuard(null);
  }, [dirty, drag.phase, savePhase, setGuard]);

  const countLabel = formatBottleCount(loadedAll ? items.length : (session?.count ?? items.length));
  const rowCount = typeGridRowCount(items.length, TYPE_GRID_COLUMNS);
  const preventTileNavigate =
    drag.suppressNavigate || assistActive || drag.phase === "drag" || drag.phase === "settling";

  function onAssistSelect(id: string) {
    setAssistId(id);
    const index = items.findIndex((item) => item.id === id);
    const item = items[index];
    if (item) {
      announce(
        typeGridLiveMessage({
          kind: "assist-select",
          name: item.name,
          index,
          total: items.length,
        }),
      );
    }
  }

  function moveAssist(direction: -1 | 1) {
    if (!assistId) {
      return;
    }
    const nextIds = moveSelectedId(
      items.map((item) => item.id),
      assistId,
      direction,
    );
    setItems(applyItemsOrder(items, nextIds));
    const index = nextIds.indexOf(assistId);
    const item = items.find((row) => row.id === assistId);
    if (item && index >= 0) {
      announce(
        typeGridLiveMessage({
          kind: "position",
          name: item.name,
          index,
          total: nextIds.length,
        }),
      );
    }
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
      data-phase={drag.phase}
    >
      <header className="type-grid-bar">
        <button
          type="button"
          className="header-text-link"
          onClick={() => requestClose()}
          disabled={savePhase === "saving"}
        >
          完了
        </button>
        <h2 className="type-grid-title" id="type-grid-title">
          {DRINK_TYPE_LABELS[drinkType]}
          <span className="app-header-muted">{countLabel}</span>
        </h2>
        <span className="type-grid-bar-end" />
      </header>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <div className="type-grid-body" ref={scrollerRef}>
        {searchActive ? null : (
          <div className="type-grid-tools">
            <p className="type-grid-hint">長押しして並べ替え</p>
            {listReady || assistActive ? (
              <button
                type="button"
                className="type-grid-assist-launch"
                ref={assistLaunchRef}
                disabled={!canReorder && !assistActive}
                onClick={() => {
                  if (assistActive) {
                    return;
                  }
                  setAssistActive(true);
                  const first = items[0];
                  if (first) {
                    onAssistSelect(first.id);
                    window.setTimeout(() => {
                      gridRef.current
                        ?.querySelector<HTMLElement>(`[data-bottle-id="${first.id}"] button`)
                        ?.focus();
                    }, 0);
                  }
                }}
              >
                並べ替え
              </button>
            ) : null}
          </div>
        )}
        {assistActive ? (
          <div className="type-grid-assist" role="toolbar" aria-label="並べ替え">
            <button type="button" className="type-grid-assist-btn" onClick={() => moveAssist(-1)}>
              前へ
            </button>
            <button type="button" className="type-grid-assist-btn" onClick={() => moveAssist(1)}>
              次へ
            </button>
            <button
              type="button"
              className="type-grid-assist-btn"
              onClick={() => {
                setAssistActive(false);
                const selected = assistId;
                setAssistId(null);
                window.setTimeout(() => {
                  if (selected) {
                    gridRef.current
                      ?.querySelector<HTMLElement>(`[data-bottle-id="${selected}"] button`)
                      ?.focus();
                    return;
                  }
                  assistLaunchRef.current?.focus();
                }, 0);
              }}
            >
              決定
            </button>
          </div>
        ) : null}
        {saveError ? (
          <div className="type-grid-save-error" role="alert">
            <p>{saveError}</p>
            <button
              type="button"
              className="type-grid-assist-btn"
              onClick={() => {
                void persist();
              }}
            >
              {savePhase === "conflict" ? "最新の棚を読み込む" : "再試行"}
            </button>
          </div>
        ) : null}
        {query.isPending || (open && !loadedAll && !query.isError) ? (
          <ShelfSkeleton columns={TYPE_GRID_COLUMNS} rows={2} />
        ) : null}
        {query.isError ? (
          <QueryError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : null}
        {loadedAll && !query.isError ? (
          <div className="type-grid-shelf" ref={gridRef}>
            {items.map((item, index) => {
              const place = typeGridCellPlacement(index, TYPE_GRID_COLUMNS);
              const ghost = drag.activeId === item.id;
              return (
                <div
                  className="type-grid-cell"
                  data-bottle-id={item.id}
                  data-ghost={ghost ? "1" : undefined}
                  data-reorder={listReady ? "1" : undefined}
                  data-selected={assistActive && assistId === item.id ? "1" : undefined}
                  key={item.id}
                  style={{ gridColumn: place.column, gridRow: place.row }}
                >
                  <BottleTile
                    item={item}
                    mode="cellar"
                    size="type"
                    preventNavigate={preventTileNavigate}
                    suppressNativePress
                    lockTouchAction={listReady}
                    onPointerDown={(event) => drag.onCellPointerDown(event, item.id)}
                    onActivate={assistActive ? () => onAssistSelect(item.id) : undefined}
                  />
                </div>
              );
            })}
            {Array.from({ length: rowCount }, (_, row) => `board-${row}`).map((boardId, row) => (
              <div
                className="type-grid-board shelf-board"
                key={boardId}
                aria-hidden="true"
                style={{ gridColumn: "1 / -1", gridRow: typeGridBoardRow(row) }}
              />
            ))}
          </div>
        ) : null}
      </div>
      <TypeGridDragPreview
        follow={drag.follow}
        layerRef={followRef}
        lifted={drag.phase === "drag" && !reduceMotion}
      />
    </div>
  );
}
