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
      // #region agent log
      agentDebug({
        hypothesisId: "H",
        location: "ToastProvider.tsx:expire:entry",
        message: "Toast expiry timer fired",
        data: {
          toastId: id,
          activeToastId: timerState?.id ?? null,
          timerState: timerState?.state ?? "missing",
          elapsedMs: toastRef.current?.id === id ? Date.now() - toastRef.current.shownAt : null,
        },
        timestamp: Date.now(),
      });
      // #endregion
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
      // #region agent log
      agentDebug({
        hypothesisId: "G|I",
        location: "ToastProvider.tsx:select:entry",
        message: "Toast action selection entered",
        data: {
          toastId: id,
          activeToastId: timerState?.id ?? null,
          timerState: timerState?.state ?? "missing",
        },
        timestamp: Date.now(),
      });
      // #endregion
      if (!timerState || timerState.id !== id) {
        return;
      }
      const transition = transitionToastTimer(timerState.state, "select");
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
      const target = document.elementFromPoint(event.clientX, event.clientY);
      // #region agent log
      agentDebug({
        hypothesisId: "F|J",
        location: "ToastProvider.tsx:document:pointerdown-hit-test",
        message: "Pointer hit-tested while toast was visible",
        data: {
          toastId: toast.id,
          phase: toast.phase,
          clientX: event.clientX,
          clientY: event.clientY,
          targetTag: target?.tagName ?? "missing",
          targetClass: typeof target?.className === "string" ? target.className : "",
          toastLeft: cardRect?.left ?? null,
          toastTop: cardRect?.top ?? null,
          toastRight: cardRect?.right ?? null,
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
  }, [toast.id, toast.phase]);

  return (
    <div
      ref={cardRef}
      className={tabsHidden ? "app-toast app-toast-no-tabs" : "app-toast"}
      data-state={toast.phase === "idle" ? undefined : toast.phase}
      role="status"
      aria-live="polite"
      onPointerDownCapture={(event) => {
        const target = event.target;
        // #region agent log
        agentDebug({
          hypothesisId: "F|H",
          location: "ToastProvider.tsx:toast:pointerdown-capture",
          message: "Toast pointer down captured",
          data: {
            toastId: toast.id,
            phase: toast.phase,
            elapsedMs: Date.now() - toast.shownAt,
            targetTag: target instanceof Element ? target.tagName : "unknown",
            actionTarget: target instanceof Element && target.closest(".app-toast-action") !== null,
          },
          timestamp: Date.now(),
        });
        // #endregion
      }}
    >
      {cheer ? <Mascot pose="cheer" size={32} pour={!reduceMotion} aria-hidden /> : null}
      <p className="app-toast-message">{toast.message}</p>
      {toast.action ? (
        <button
          ref={actionRef}
          type="button"
          className="app-toast-action"
          onPointerDown={() => {
            // #region agent log
            agentDebug({
              hypothesisId: "F|G",
              location: "ToastProvider.tsx:action:pointerdown",
              message: "Toast action pointer down received",
              data: {
                toastId: toast.id,
                phase: toast.phase,
                elapsedMs: Date.now() - toast.shownAt,
              },
              timestamp: Date.now(),
            });
            // #endregion
            onActionStart(toast.id);
          }}
          onFocus={() => onActionStart(toast.id)}
          onClick={() => {
            // #region agent log
            agentDebug({
              hypothesisId: "F|G",
              location: "ToastProvider.tsx:action:click",
              message: "Toast action click received",
              data: {
                toastId: toast.id,
                phase: toast.phase,
                elapsedMs: Date.now() - toast.shownAt,
              },
              timestamp: Date.now(),
            });
            // #endregion
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
