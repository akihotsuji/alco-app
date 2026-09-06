import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { agentDebug } from "@/client/lib/agent-debug.ts";
import { hidesTabBar } from "@/client/lib/app-routes.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import {
  TOAST_DURATION_MS,
  type ToastAction,
  type ToastInput,
  type ToastTimerState,
  toastShowsCheer,
  transitionToastTimer,
} from "@/client/lib/toast.ts";

type ToastPhase = "enter" | "idle" | "leave";

type ToastState = ToastInput & { id: number; phase: ToastPhase; shownAt: number };
type ActiveToastTimer = { id: number; state: ToastTimerState };

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  /** アクション（取り消す等）を押した直後に閉じる。滞在タイマーも止める */
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast は ToastProvider の内側で使う");
  }
  return value;
}

/**
 * 同時に 1 枚。出現は下 8px + 不透明 0 → 定位置（M-23）、退場は不透明度のみ（M-24）。
 * 置き換え時は旧を退場させてから新を出す。演出は CSS（`.app-toast[data-state]`）に任せ、
 * ここは phase を置いて `--dur-toast-out` 後に unmount するだけ。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  // updater の中で副作用（タイマー）を起こさないため、現在値は ref でも持つ
  const toastRef = useRef<ToastState | null>(null);
  toastRef.current = toast;
  const stayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStateRef = useRef<ActiveToastTimer | null>(null);
  const idRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (stayTimer.current !== null) {
      clearTimeout(stayTimer.current);
      stayTimer.current = null;
    }
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const beginLeave = useCallback((after: () => void) => {
    setToast((current) => (current ? { ...current, phase: "leave" } : current));
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      after();
    }, MOTION_MS.toastOut);
  }, []);

  const expireToast = useCallback(
    (id: number) => {
      const timerState = timerStateRef.current;
      if (!timerState || timerState.id !== id) {
        return;
      }
      const transition = transitionToastTimer(timerState.state, "timeout");
      timerStateRef.current = { id, state: transition.state };
      if (transition.effect === "dismiss") {
        beginLeave(() => setToast((current) => (current?.id === id ? null : current)));
      }
    },
    [beginLeave],
  );

  const showToast = useCallback(
    (input: ToastInput) => {
      clearTimers();
      idRef.current += 1;
      const id = idRef.current;
      const mount = () => {
        timerStateRef.current = { id, state: "running" };
        setToast({ ...input, id, phase: "enter", shownAt: Date.now() });
        stayTimer.current = setTimeout(() => {
          stayTimer.current = null;
          expireToast(id);
        }, TOAST_DURATION_MS);
      };
      const current = toastRef.current;
      if (current && current.phase !== "leave") {
        beginLeave(mount);
        return;
      }
      mount();
    },
    [beginLeave, clearTimers, expireToast],
  );

  const dismissToast = useCallback(() => {
    clearTimers();
    beginLeave(() => setToast(null));
  }, [beginLeave, clearTimers]);

  const startActionInteraction = useCallback((id: number) => {
    const timerState = timerStateRef.current;
    if (!timerState || timerState.id !== id) {
      return;
    }
    const transition = transitionToastTimer(timerState.state, "interaction-start");
    timerStateRef.current = { id, state: transition.state };
    if (transition.state === "interacting" && stayTimer.current !== null) {
      clearTimeout(stayTimer.current);
      stayTimer.current = null;
    }
  }, []);

  const selectAction = useCallback(
    (id: number, action: ToastAction) => {
      const timerState = timerStateRef.current;
      const transition =
        timerState && timerState.id === id
          ? transitionToastTimer(timerState.state, "select")
          : null;
      // #region agent log
      agentDebug({
        hypothesisId: "A",
        location: "ToastProvider.tsx:selectAction",
        message: "Toast action selection evaluated",
        data: {
          toastId: id,
          actionLabel: action.label,
          activeToastId: timerState?.id ?? null,
          timerState: timerState?.state ?? "missing",
          transitionEffect: transition?.effect ?? "ignored",
        },
        timestamp: Date.now(),
      });
      // #endregion
      if (!timerState || timerState.id !== id || !transition) {
        return;
      }
      timerStateRef.current = { id, state: transition.state };
      if (transition.effect !== "select") {
        return;
      }
      clearTimers();
      beginLeave(() => setToast((current) => (current?.id === id ? null : current)));
      action.onSelect();
    },
    [beginLeave, clearTimers],
  );

  const onEntered = useCallback((id: number) => {
    setToast((current) =>
      current && current.id === id && current.phase === "enter"
        ? { ...current, phase: "idle" }
        : current,
    );
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toast ? (
        <ToastCard
          key={toast.id}
          toast={toast}
          onEntered={onEntered}
          onActionStart={startActionInteraction}
          onActionSelect={selectAction}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onEntered,
  onActionStart,
  onActionSelect,
}: {
  toast: ToastState;
  onEntered: (id: number) => void;
  onActionStart: (id: number) => void;
  onActionSelect: (id: number, action: ToastAction) => void;
}) {
  const location = useLocation();
  const photoEdit = usePhotoEdit();
  const reduceMotion = useReducedMotion();
  const tabsHidden = hidesTabBar(location.pathname, photoEdit.open);
  const cheer = toastShowsCheer(toast.message);
  const cardRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // #region agent log
    agentDebug({
      hypothesisId: "K|L",
      location: "ToastProvider.tsx:ToastCard:phase-rendered",
      message: "Toast phase rendered",
      data: {
        toastId: toast.id,
        phase: toast.phase,
        elapsedMs: Date.now() - toast.shownAt,
        hasAction: toast.action !== undefined,
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [toast.action, toast.id, toast.phase, toast.shownAt]);

  // 初回描画は enter（下 8px・不透明 0）で置き、1 フレーム描かせてから idle に戻して transition を走らせる
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => onEntered(toast.id));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [onEntered, toast.id]);

  useEffect(() => {
    const captureHitTest = (event: PointerEvent) => {
      const cardRect = cardRef.current?.getBoundingClientRect();
      const actionRect = actionRef.current?.getBoundingClientRect();
      const hitTarget = document.elementFromPoint(event.clientX, event.clientY);
      const eventTarget = event.target;
      // #region agent log
      agentDebug({
        hypothesisId: "F|G|H|J",
        location: "ToastProvider.tsx:document:pointerdown-hit-test",
        message: "Pointer hit-tested while toast was mounted",
        data: {
          toastId: toast.id,
          phase: toast.phase,
          elapsedMs: Date.now() - toast.shownAt,
          clientX: event.clientX,
          clientY: event.clientY,
          eventTargetTag: eventTarget instanceof Element ? eventTarget.tagName : "unknown",
          eventTargetClass:
            eventTarget instanceof Element && typeof eventTarget.className === "string"
              ? eventTarget.className
              : "",
          hitTargetTag: hitTarget?.tagName ?? "missing",
          hitTargetClass: typeof hitTarget?.className === "string" ? hitTarget.className : "",
          toastTop: cardRect?.top ?? null,
          toastBottom: cardRect?.bottom ?? null,
          actionLeft: actionRect?.left ?? null,
          actionTop: actionRect?.top ?? null,
          actionRight: actionRect?.right ?? null,
          actionBottom: actionRect?.bottom ?? null,
          insideAction:
            actionRect !== undefined &&
            event.clientX >= actionRect.left &&
            event.clientX <= actionRect.right &&
            event.clientY >= actionRect.top &&
            event.clientY <= actionRect.bottom,
        },
        timestamp: Date.now(),
      });
      // #endregion
    };
    document.addEventListener("pointerdown", captureHitTest, true);
    return () => document.removeEventListener("pointerdown", captureHitTest, true);
  }, [toast.id, toast.phase, toast.shownAt]);

  useEffect(() => {
    if (toast.phase !== "idle") {
      return;
    }
    const actionRect = actionRef.current?.getBoundingClientRect();
    const centerX = actionRect ? actionRect.left + actionRect.width / 2 : null;
    const centerY = actionRect ? actionRect.top + actionRect.height / 2 : null;
    const hitTarget =
      centerX !== null && centerY !== null ? document.elementFromPoint(centerX, centerY) : null;
    const hitStack =
      centerX !== null && centerY !== null
        ? document
            .elementsFromPoint(centerX, centerY)
            .slice(0, 5)
            .map((element) => `${element.tagName}.${String(element.className)}`)
            .join(" > ")
        : "";
    // #region agent log
    agentDebug({
      hypothesisId: "F|G|H",
      location: "ToastProvider.tsx:ToastCard:idle-center-hit-test",
      message: "Toast action center hit-tested after idle render",
      data: {
        toastId: toast.id,
        centerX,
        centerY,
        hitTargetTag: hitTarget?.tagName ?? "missing",
        hitTargetClass: typeof hitTarget?.className === "string" ? hitTarget.className : "",
        hitStack,
        actionPointerEvents: actionRef.current
          ? getComputedStyle(actionRef.current).pointerEvents
          : "missing",
        cardPointerEvents: cardRef.current
          ? getComputedStyle(cardRef.current).pointerEvents
          : "missing",
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visualViewportScale: window.visualViewport?.scale ?? null,
        visualViewportOffsetLeft: window.visualViewport?.offsetLeft ?? null,
        visualViewportOffsetTop: window.visualViewport?.offsetTop ?? null,
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [toast.id, toast.phase]);

  useEffect(() => {
    const captureInput = (event: Event) => {
      const firstTouch = event instanceof TouchEvent ? event.touches.item(0) : null;
      const point =
        event instanceof MouseEvent
          ? { clientX: event.clientX, clientY: event.clientY }
          : firstTouch
            ? { clientX: firstTouch.clientX, clientY: firstTouch.clientY }
            : null;
      const hitTarget = point ? document.elementFromPoint(point.clientX, point.clientY) : null;
      const eventTarget = event.target;
      // #region agent log
      agentDebug({
        hypothesisId: "F|G|H|J",
        location: "ToastProvider.tsx:window:input-capture",
        message: "Window captured input while toast was mounted",
        data: {
          toastId: toast.id,
          eventType: event.type,
          clientX: point?.clientX ?? null,
          clientY: point?.clientY ?? null,
          eventTargetTag: eventTarget instanceof Element ? eventTarget.tagName : "unknown",
          eventTargetClass:
            eventTarget instanceof Element && typeof eventTarget.className === "string"
              ? eventTarget.className
              : "",
          hitTargetTag: hitTarget?.tagName ?? "missing",
          hitTargetClass: typeof hitTarget?.className === "string" ? hitTarget.className : "",
        },
        timestamp: Date.now(),
      });
      // #endregion
    };
    const eventTypes = ["pointerdown", "mousedown", "mouseup", "click", "touchstart"] as const;
    for (const eventType of eventTypes) {
      window.addEventListener(eventType, captureInput, true);
    }
    return () => {
      for (const eventType of eventTypes) {
        window.removeEventListener(eventType, captureInput, true);
      }
    };
  }, [toast.id]);

  useEffect(() => {
    const capturePageExit = (event: Event) => {
      // #region agent log
      agentDebug({
        hypothesisId: "G|J",
        location: "ToastProvider.tsx:window:page-exit",
        message: "Page focus or visibility changed while toast was mounted",
        data: {
          toastId: toast.id,
          eventType: event.type,
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus(),
          activeElementTag: document.activeElement?.tagName ?? "missing",
          activeElementClass:
            typeof document.activeElement?.className === "string"
              ? document.activeElement.className
              : "",
        },
        timestamp: Date.now(),
      });
      // #endregion
    };
    window.addEventListener("blur", capturePageExit);
    document.addEventListener("visibilitychange", capturePageExit);
    return () => {
      window.removeEventListener("blur", capturePageExit);
      document.removeEventListener("visibilitychange", capturePageExit);
    };
  }, [toast.id]);

  return (
    <div
      ref={cardRef}
      className={tabsHidden ? "app-toast app-toast-no-tabs" : "app-toast"}
      data-state={toast.phase === "idle" ? undefined : toast.phase}
      role="status"
      aria-live="polite"
    >
      {cheer ? <Mascot pose="cheer" size={32} pour={!reduceMotion} aria-hidden /> : null}
      <p className="app-toast-message">{toast.message}</p>
      {toast.action ? (
        <button
          ref={actionRef}
          type="button"
          className="app-toast-action"
          onPointerDown={() => onActionStart(toast.id)}
          onFocus={() => onActionStart(toast.id)}
          onClick={() => {
            if (toast.action) {
              onActionSelect(toast.id, toast.action);
            }
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
