import {
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { TypeGridFollowState } from "@/client/components/cellar/TypeGridDragPreview.tsx";
import {
  advanceTypeGridGesture,
  capturePointerSafe,
  shiftRectsForScroll,
  TYPE_GRID_LONG_PRESS_MS,
  type TypeGridGesture,
} from "@/client/lib/cellar-shelf.ts";
import { haptic } from "@/client/lib/haptic.ts";
import {
  applyItemsOrder,
  edgeScrollDeltaByTime,
  edgeScrollVelocityPxPerSec,
  followLayerPosition,
  grabOffset,
  invertFlip,
  isCurrentGeneration,
  isSignificantViewportChange,
  orderFromInsert,
  pickInsertIndex,
  pointInRect,
  readCssDurationMs,
  shouldAnnouncePosition,
  shouldIgnorePointer,
  shouldTreatLostCaptureAsInterrupt,
  TYPE_GRID_LIFT_PX,
  TYPE_GRID_SETTLE_MS,
  type TypeGridPhase,
  typeGridLiveMessage,
} from "@/client/lib/type-grid-drag.ts";
import type { BottleItem } from "@/shared/bottles.ts";

type DragSession = {
  generation: number;
  phase: TypeGridPhase;
  pointerId: number | null;
  activeId: string | null;
  startIds: string[];
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  grabX: number;
  grabY: number;
  startRect: { left: number; top: number; width: number; height: number } | null;
  insertIndex: number;
  slots: {
    rects: { left: number; top: number; width: number; height: number }[];
    scrollTop: number;
  } | null;
  ending: boolean;
  lastFrameAt: number;
  lastAnnounceAt: number;
  captureTarget: Element | null;
  transferringCapture: boolean;
};

function emptySession(): DragSession {
  return {
    generation: 0,
    phase: "idle",
    pointerId: null,
    activeId: null,
    startIds: [],
    startX: 0,
    startY: 0,
    latestX: 0,
    latestY: 0,
    grabX: 0,
    grabY: 0,
    startRect: null,
    insertIndex: 0,
    slots: null,
    ending: false,
    lastFrameAt: 0,
    lastAnnounceAt: 0,
    captureTarget: null,
    transferringCapture: false,
  };
}

function readSlotRects(root: HTMLElement | null): {
  left: number;
  top: number;
  width: number;
  height: number;
}[] {
  if (!root) {
    return [];
  }
  return [...root.querySelectorAll<HTMLElement>("[data-bottle-id]")].map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
}

function readBottleRects(root: HTMLElement | null): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  if (!root) {
    return map;
  }
  for (const node of root.querySelectorAll<HTMLElement>("[data-bottle-id]")) {
    const id = node.dataset.bottleId;
    if (id) {
      map.set(id, node.getBoundingClientRect());
    }
  }
  return map;
}

function readReadySrc(root: HTMLElement | null): string | null {
  if (!root) {
    return null;
  }
  const img = root.querySelector<HTMLImageElement>("img.bottle-tile-img");
  if (!img) {
    return null;
  }
  const ready = img.dataset.state === "loaded" || (img.complete && img.naturalWidth > 0);
  return ready ? img.getAttribute("src") : null;
}

function releaseCapture(target: Element | null, pointerId: number | null): void {
  if (!target || pointerId === null || !("releasePointerCapture" in target)) {
    return;
  }
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // 既に離れている
  }
}

function clearNodeAnimations(root: HTMLElement | null): void {
  if (!root) {
    return;
  }
  for (const node of root.querySelectorAll<HTMLElement>("[data-bottle-id]")) {
    for (const animation of node.getAnimations()) {
      animation.cancel();
    }
    node.style.transform = "";
    node.style.transition = "";
  }
}

export function useTypeGridDrag(input: {
  enabled: boolean;
  items: BottleItem[];
  itemsRef: MutableRefObject<BottleItem[]>;
  setItems: Dispatch<SetStateAction<BottleItem[]>>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  gridRef: RefObject<HTMLDivElement | null>;
  followRef: RefObject<HTMLDivElement | null>;
  reduceMotion: boolean;
  visible: boolean;
  announce: (message: string) => void;
}): {
  phase: TypeGridPhase;
  activeId: string | null;
  follow: TypeGridFollowState | null;
  suppressNavigate: boolean;
  onCellPointerDown: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  cancelActiveGesture: () => void;
  abortForClose: () => void;
  completeSettlingNow: () => void;
} {
  const [phase, setPhase] = useState<TypeGridPhase>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [follow, setFollow] = useState<TypeGridFollowState | null>(null);
  const [suppressNavigate, setSuppressNavigate] = useState(false);
  const sessionRef = useRef<DragSession>(emptySession());
  const gestureRef = useRef<TypeGridGesture>({ kind: "idle" });
  const pressTimerRef = useRef(0);
  const rafRef = useRef(0);
  const settleTimerRef = useRef(0);
  const flipFirstRef = useRef<Map<string, DOMRect> | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = 0;
    }
  }, []);

  const cancelRaf = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const applyFollowTransform = useCallback(() => {
    const session = sessionRef.current;
    const layer = inputRef.current.followRef.current;
    if (!layer || !session.startRect) {
      return;
    }
    const next = followLayerPosition(
      session.latestX,
      session.latestY,
      session.grabX,
      session.grabY,
    );
    layer.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
  }, []);

  const resetIdle = useCallback(
    (opts?: { keepSuppress?: boolean }) => {
      const session = sessionRef.current;
      clearPressTimer();
      cancelRaf();
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = 0;
      }
      const layer = inputRef.current.followRef.current;
      if (layer) {
        for (const animation of layer.getAnimations()) {
          animation.cancel();
        }
        layer.style.transform = "";
      }
      releaseCapture(session.captureTarget, session.pointerId);
      session.phase = "idle";
      session.pointerId = null;
      session.activeId = null;
      session.startIds = [];
      session.startRect = null;
      session.slots = null;
      session.ending = false;
      session.captureTarget = null;
      session.transferringCapture = false;
      session.lastFrameAt = 0;
      gestureRef.current = { kind: "idle" };
      setPhase("idle");
      setActiveId(null);
      setFollow(null);
      if (!opts?.keepSuppress) {
        setSuppressNavigate(false);
      }
    },
    [cancelRaf, clearPressTimer],
  );

  const runFlip = useCallback((first: Map<string, DOMRect>, liftedId: string | null) => {
    const root = inputRef.current.gridRef.current;
    if (!root || inputRef.current.reduceMotion) {
      return;
    }
    const styles = getComputedStyle(root);
    const duration = readCssDurationMs(styles, "--dur-state", 200);
    const easing = styles.getPropertyValue("--ease-out").trim() || "ease-out";
    for (const node of root.querySelectorAll<HTMLElement>("[data-bottle-id]")) {
      const id = node.dataset.bottleId;
      if (!id || id === liftedId) {
        continue;
      }
      const prev = first.get(id);
      if (!prev) {
        continue;
      }
      const last = node.getBoundingClientRect();
      const { dx, dy } = invertFlip(prev, last);
      if (dx === 0 && dy === 0) {
        continue;
      }
      for (const animation of node.getAnimations()) {
        animation.cancel();
      }
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration, easing },
      );
    }
  }, []);

  const previewInsert = useCallback((insertIndex: number) => {
    const session = sessionRef.current;
    if (!session.activeId) {
      return;
    }
    const ids = orderFromInsert(session.startIds, session.activeId, insertIndex);
    const first = readBottleRects(inputRef.current.gridRef.current);
    flipFirstRef.current = first;
    inputRef.current.setItems(applyItemsOrder(inputRef.current.itemsRef.current, ids));
    const now = performance.now();
    if (shouldAnnouncePosition(session.lastAnnounceAt, now)) {
      const item = inputRef.current.itemsRef.current.find((row) => row.id === session.activeId);
      if (item) {
        inputRef.current.announce(
          typeGridLiveMessage({
            kind: "position",
            name: item.name,
            index: insertIndex,
            total: session.startIds.length,
          }),
        );
        session.lastAnnounceAt = now;
      }
    }
  }, []);

  const processDragPoint = useCallback(
    (clientX: number, clientY: number, timestamp: number) => {
      const session = sessionRef.current;
      if (session.phase !== "drag" || !session.slots) {
        return;
      }
      session.latestX = clientX;
      session.latestY = clientY;
      applyFollowTransform();
      const scroller = inputRef.current.scrollerRef.current;
      if (!scroller) {
        return;
      }
      const bounds = scroller.getBoundingClientRect();
      const dt = session.lastFrameAt === 0 ? 16 : timestamp - session.lastFrameAt;
      session.lastFrameAt = timestamp;
      const velocity = edgeScrollVelocityPxPerSec(clientY, bounds.top, bounds.bottom);
      if (velocity !== 0) {
        const before = scroller.scrollTop;
        scroller.scrollTop += edgeScrollDeltaByTime(velocity, dt);
        if (
          scroller.scrollTop === before &&
          (before <= 0 || before >= scroller.scrollHeight - scroller.clientHeight)
        ) {
          // 上下限。無駄な更新はしない
        }
      }
      const rects = shiftRectsForScroll(
        session.slots.rects,
        scroller.scrollTop - session.slots.scrollTop,
      );
      const nextIndex = pickInsertIndex({
        clientX,
        clientY,
        rects,
        currentIndex: session.insertIndex,
        inShelf: pointInRect(clientX, clientY, bounds),
      });
      if (nextIndex !== session.insertIndex) {
        session.insertIndex = nextIndex;
        previewInsert(nextIndex);
      }
    },
    [applyFollowTransform, previewInsert],
  );

  const scheduleFrame = useCallback(() => {
    if (rafRef.current) {
      return;
    }
    rafRef.current = window.requestAnimationFrame((time) => {
      rafRef.current = 0;
      const session = sessionRef.current;
      if (session.phase !== "drag") {
        return;
      }
      processDragPoint(session.latestX, session.latestY, time);
      const scroller = inputRef.current.scrollerRef.current;
      if (!scroller) {
        return;
      }
      const bounds = scroller.getBoundingClientRect();
      if (edgeScrollVelocityPxPerSec(session.latestY, bounds.top, bounds.bottom) !== 0) {
        scheduleFrame();
      }
    });
  }, [processDragPoint]);

  const finishSettle = useCallback(
    (expected: number) => {
      const session = sessionRef.current;
      if (!isCurrentGeneration(session.generation, expected) || session.phase !== "settling") {
        return;
      }
      resetIdle({ keepSuppress: true });
    },
    [resetIdle],
  );

  const completeSettlingNow = useCallback(() => {
    const session = sessionRef.current;
    if (session.phase !== "settling") {
      return;
    }
    finishSettle(session.generation);
  }, [finishSettle]);

  const beginSettle = useCallback(() => {
    const session = sessionRef.current;
    if (session.phase !== "drag" || !session.activeId) {
      resetIdle({ keepSuppress: true });
      return;
    }
    cancelRaf();
    processDragPoint(session.latestX, session.latestY, performance.now());
    const ids = orderFromInsert(session.startIds, session.activeId, session.insertIndex);
    inputRef.current.setItems(applyItemsOrder(inputRef.current.itemsRef.current, ids));
    session.phase = "settling";
    session.ending = true;
    gestureRef.current = { kind: "idle" };
    setPhase("settling");
    const layer = inputRef.current.followRef.current;
    const grid = inputRef.current.gridRef.current;
    const target = grid?.querySelector<HTMLElement>(`[data-bottle-id="${session.activeId}"]`);
    const generation = session.generation;
    if (!layer || !target || inputRef.current.reduceMotion) {
      finishSettle(generation);
      return;
    }
    const from = followLayerPosition(
      session.latestX,
      session.latestY,
      session.grabX,
      session.grabY,
    );
    const dest = target.getBoundingClientRect();
    const styles = getComputedStyle(layer);
    const duration = readCssDurationMs(styles, "--dur-type-grid-settle", TYPE_GRID_SETTLE_MS);
    const easing = styles.getPropertyValue("--ease-out").trim() || "ease-out";
    for (const animation of layer.getAnimations()) {
      animation.cancel();
    }
    const animation = layer.animate(
      [
        { transform: `translate3d(${from.x}px, ${from.y}px, 0)` },
        { transform: `translate3d(${dest.left}px, ${dest.top}px, 0)` },
      ],
      { duration, easing, fill: "forwards" },
    );
    const inner = layer.querySelector<HTMLElement>(".type-grid-follow-inner");
    if (inner) {
      inner.animate(
        [{ transform: `translateY(-${TYPE_GRID_LIFT_PX}px)` }, { transform: "translateY(0)" }],
        { duration, easing, fill: "forwards" },
      );
    }
    const done = () => finishSettle(generation);
    animation.addEventListener("finish", done);
    settleTimerRef.current = window.setTimeout(done, duration + 40);
  }, [cancelRaf, finishSettle, processDragPoint, resetIdle]);

  const cancelActiveGesture = useCallback(() => {
    const session = sessionRef.current;
    if (session.phase === "idle") {
      return;
    }
    if (session.phase === "settling") {
      completeSettlingNow();
      return;
    }
    const shouldRevert = session.phase === "drag" && session.startIds.length > 0;
    const startIds = session.startIds;
    const generation = session.generation;
    if (shouldRevert) {
      inputRef.current.setItems(applyItemsOrder(inputRef.current.itemsRef.current, startIds));
      inputRef.current.announce(
        typeGridLiveMessage({
          kind: "cancelled",
          name: "",
          index: 0,
          total: startIds.length,
        }),
      );
    }
    session.generation = generation + 1;
    resetIdle({ keepSuppress: session.phase !== "press" });
  }, [completeSettlingNow, resetIdle]);

  const abortForClose = useCallback(() => {
    const session = sessionRef.current;
    if (session.phase === "settling") {
      completeSettlingNow();
      return;
    }
    cancelActiveGesture();
  }, [cancelActiveGesture, completeSettlingNow]);

  const beginDrag = useCallback(() => {
    const session = sessionRef.current;
    if (session.phase !== "press" || !session.activeId || !session.startRect) {
      return;
    }
    const items = inputRef.current.itemsRef.current;
    const item = items.find((row) => row.id === session.activeId);
    if (!item) {
      resetIdle();
      return;
    }
    const cell =
      inputRef.current.gridRef.current?.querySelector<HTMLElement>(
        `[data-bottle-id="${session.activeId}"]`,
      ) ?? null;
    session.phase = "drag";
    session.startIds = items.map((row) => row.id);
    session.insertIndex = items.findIndex((row) => row.id === session.activeId);
    session.slots = {
      rects: readSlotRects(inputRef.current.gridRef.current),
      scrollTop: inputRef.current.scrollerRef.current?.scrollTop ?? 0,
    };
    session.lastFrameAt = 0;
    // タイルは挿入プレビューで DOM 順が変わる。capture を動かない親へ移す
    const grid = inputRef.current.gridRef.current;
    const host = grid?.closest(".type-grid") ?? grid;
    if (host && session.pointerId !== null) {
      session.transferringCapture = true;
      if (capturePointerSafe(host, session.pointerId)) {
        session.captureTarget = host;
      }
      session.transferringCapture = false;
    }
    gestureRef.current = {
      kind: "drag",
      pointerId: session.pointerId ?? 0,
      id: session.activeId,
    };
    setPhase("drag");
    setActiveId(session.activeId);
    setFollow({
      item,
      width: session.startRect.width,
      readySrc: readReadySrc(cell),
    });
    setSuppressNavigate(true);
    haptic("light");
    inputRef.current.announce(
      typeGridLiveMessage({
        kind: "moving",
        name: item.name,
        index: session.insertIndex,
        total: items.length,
      }),
    );
    session.lastAnnounceAt = performance.now();
  }, [resetIdle]);

  const onCellPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, id: string) => {
      const current = inputRef.current;
      const session = sessionRef.current;
      if (!current.enabled || !current.visible || event.button !== 0) {
        return;
      }
      if (shouldIgnorePointer(session.pointerId, event.pointerId, session.phase)) {
        return;
      }
      if (session.phase === "settling") {
        completeSettlingNow();
      }
      if (session.phase !== "idle") {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      if (!capturePointerSafe(event.currentTarget, event.pointerId)) {
        return;
      }
      session.generation += 1;
      session.phase = "press";
      session.pointerId = event.pointerId;
      session.activeId = id;
      session.startX = event.clientX;
      session.startY = event.clientY;
      session.latestX = event.clientX;
      session.latestY = event.clientY;
      session.startRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      const grab = grabOffset(session.startRect, event.clientX, event.clientY);
      session.grabX = grab.grabX;
      session.grabY = grab.grabY;
      session.ending = false;
      session.captureTarget = event.currentTarget;
      gestureRef.current = {
        kind: "press",
        pointerId: event.pointerId,
        id,
        x: event.clientX,
        y: event.clientY,
      };
      setPhase("press");
      setSuppressNavigate(false);
      clearPressTimer();
      pressTimerRef.current = window.setTimeout(() => {
        const next = advanceTypeGridGesture(gestureRef.current, { type: "longpress", id });
        if (next.gesture.kind !== "drag") {
          return;
        }
        gestureRef.current = next.gesture;
        beginDrag();
      }, TYPE_GRID_LONG_PRESS_MS);
    },
    [beginDrag, clearPressTimer, completeSettlingNow],
  );

  const orderKey = input.items.map((item) => item.id).join(",");
  useLayoutEffect(() => {
    void orderKey;
    const first = flipFirstRef.current;
    flipFirstRef.current = null;
    if (!first) {
      return;
    }
    runFlip(first, sessionRef.current.activeId);
  }, [orderKey, runFlip]);

  useLayoutEffect(() => {
    if (follow && (phase === "drag" || phase === "settling")) {
      applyFollowTransform();
    }
  }, [applyFollowTransform, follow, phase]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (shouldIgnorePointer(session.pointerId, event.pointerId, session.phase)) {
        return;
      }
      session.latestX = event.clientX;
      session.latestY = event.clientY;
      const current = gestureRef.current;
      const next = advanceTypeGridGesture(current, {
        type: "move",
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      if (next.gesture.kind === "scroll" && current.kind === "press") {
        clearPressTimer();
        session.phase = "scroll";
        setPhase("scroll");
        setSuppressNavigate(true);
      }
      gestureRef.current = next.gesture;
      if (next.scrollDy !== 0) {
        event.preventDefault();
        const scroller = inputRef.current.scrollerRef.current;
        if (scroller) {
          scroller.scrollTop += next.scrollDy;
        }
        return;
      }
      if (session.phase === "drag") {
        event.preventDefault();
        scheduleFrame();
      }
    }

    function onUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (session.pointerId !== event.pointerId) {
        return;
      }
      session.latestX = event.clientX;
      session.latestY = event.clientY;
      session.ending = true;
      const current = gestureRef.current;
      const next = advanceTypeGridGesture(current, { type: "up", pointerId: event.pointerId });
      gestureRef.current = next.gesture;
      clearPressTimer();
      if (current.kind === "drag" || session.phase === "drag") {
        cancelRaf();
        processDragPoint(event.clientX, event.clientY, performance.now());
        beginSettle();
        return;
      }
      resetIdle({ keepSuppress: current.kind === "scroll" });
    }

    function onCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (session.pointerId !== event.pointerId) {
        return;
      }
      cancelActiveGesture();
    }

    function onLost(event: PointerEvent) {
      const session = sessionRef.current;
      if (session.pointerId !== event.pointerId) {
        return;
      }
      const stillCaptured = Boolean(
        session.captureTarget &&
          "hasPointerCapture" in session.captureTarget &&
          session.captureTarget.hasPointerCapture(event.pointerId),
      );
      if (
        !shouldTreatLostCaptureAsInterrupt({
          ending: session.ending,
          transferringCapture: session.transferringCapture,
          phase: session.phase,
          stillCaptured,
        })
      ) {
        return;
      }
      if (session.captureTarget && capturePointerSafe(session.captureTarget, event.pointerId)) {
        return;
      }
      cancelActiveGesture();
    }

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    function onViewportChange() {
      const next = { width: window.innerWidth, height: window.innerHeight };
      if (!isSignificantViewportChange(viewport, next)) {
        return;
      }
      viewport.width = next.width;
      viewport.height = next.height;
      const session = sessionRef.current;
      if (session.phase === "press" || session.phase === "drag" || session.phase === "scroll") {
        cancelActiveGesture();
      } else if (session.phase === "settling") {
        completeSettlingNow();
      }
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("lostpointercapture", onLost);
    window.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("lostpointercapture", onLost);
      window.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [
    beginSettle,
    cancelActiveGesture,
    cancelRaf,
    clearPressTimer,
    completeSettlingNow,
    processDragPoint,
    resetIdle,
    scheduleFrame,
  ]);

  useEffect(() => {
    if (!input.visible) {
      abortForClose();
    }
  }, [abortForClose, input.visible]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session.activeId && !input.items.some((item) => item.id === session.activeId)) {
      session.generation += 1;
      resetIdle();
    }
  }, [input.items, resetIdle]);

  useEffect(() => {
    return () => {
      clearPressTimer();
      cancelRaf();
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
      clearNodeAnimations(inputRef.current.gridRef.current);
    };
  }, [cancelRaf, clearPressTimer]);

  return {
    phase,
    activeId,
    follow,
    suppressNavigate,
    onCellPointerDown,
    cancelActiveGesture,
    abortForClose,
    completeSettlingNow,
  };
}
