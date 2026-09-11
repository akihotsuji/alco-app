import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import {
  remainingToastMs,
  type ToastAction,
  type ToastInput,
  type ToastTimerState,
  toastShowsCheer,
  toastStayMs,
  transitionToastTimer,
} from "@/client/lib/toast.ts";

type ToastPhase = "enter" | "idle" | "leave";

type ToastState = ToastInput & { id: number; phase: ToastPhase };
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

type ToastViewContextValue = {
  toast: ToastState | null;
  onEntered: (id: number) => void;
  onEntryComplete: (id: number) => void;
  onActionStart: (id: number) => void;
  onActionEnd: (id: number) => void;
  onActionSelect: (id: number, action: ToastAction) => void;
  onDismiss: () => void;
};

const ToastViewContext = createContext<ToastViewContextValue | null>(null);

/**
 * 同時に 1 枚。出現は上 8px + 不透明 0 → 定位置（M-23）、退場は不透明度のみ（M-24）。
 * 置き換え時は旧を退場させてから新を出す。画面遷移では消さない。
 * 表示は AppShell のヘッダー直下スロット（ToastHost）に出し、保存バーやタブを覆わない。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastRef = useRef<ToastState | null>(null);
  toastRef.current = toast;
  const stayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStateRef = useRef<ActiveToastTimer | null>(null);
  const remainingMsRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const clearStayTimer = useCallback(() => {
    if (stayTimer.current !== null) {
      clearTimeout(stayTimer.current);
      stayTimer.current = null;
    }
    runningSinceRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    clearStayTimer();
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, [clearStayTimer]);

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

  const startStayTimer = useCallback(
    (id: number, durationMs: number) => {
      clearStayTimer();
      remainingMsRef.current = durationMs;
      runningSinceRef.current = Date.now();
      stayTimer.current = setTimeout(() => {
        stayTimer.current = null;
        runningSinceRef.current = null;
        expireToast(id);
      }, durationMs);
    },
    [clearStayTimer, expireToast],
  );

  const pauseStayTimer = useCallback(() => {
    if (runningSinceRef.current !== null) {
      remainingMsRef.current = remainingToastMs(
        runningSinceRef.current,
        remainingMsRef.current,
        Date.now(),
      );
    }
    clearStayTimer();
  }, [clearStayTimer]);

  const showToast = useCallback(
    (input: ToastInput) => {
      clearTimers();
      idRef.current += 1;
      const id = idRef.current;
      remainingMsRef.current = toastStayMs(Boolean(input.action));
      runningSinceRef.current = null;
      const mount = () => {
        timerStateRef.current = { id, state: "entering" };
        setToast({ ...input, id, phase: "enter" });
      };
      const current = toastRef.current;
      if (current && current.phase !== "leave") {
        beginLeave(mount);
        return;
      }
      mount();
    },
    [beginLeave, clearTimers],
  );

  const completeEntry = useCallback(
    (id: number) => {
      const timerState = timerStateRef.current;
      if (!timerState || timerState.id !== id) {
        return;
      }
      const transition = transitionToastTimer(timerState.state, "entry-complete");
      timerStateRef.current = { id, state: transition.state };
      if (transition.effect !== "start-timer") {
        return;
      }
      startStayTimer(id, remainingMsRef.current || toastStayMs(Boolean(toastRef.current?.action)));
    },
    [startStayTimer],
  );

  const dismissToast = useCallback(() => {
    clearTimers();
    beginLeave(() => setToast(null));
  }, [beginLeave, clearTimers]);

  const startActionInteraction = useCallback(
    (id: number) => {
      const timerState = timerStateRef.current;
      if (!timerState || timerState.id !== id) {
        return;
      }
      const transition = transitionToastTimer(timerState.state, "interaction-start");
      timerStateRef.current = { id, state: transition.state };
      if (transition.effect === "pause-timer") {
        pauseStayTimer();
      }
    },
    [pauseStayTimer],
  );

  const endActionInteraction = useCallback(
    (id: number) => {
      const timerState = timerStateRef.current;
      if (!timerState || timerState.id !== id) {
        return;
      }
      const transition = transitionToastTimer(timerState.state, "interaction-end");
      timerStateRef.current = { id, state: transition.state };
      if (transition.effect !== "start-timer") {
        return;
      }
      const remaining = remainingMsRef.current;
      if (remaining <= 0) {
        expireToast(id);
        return;
      }
      startStayTimer(id, remaining);
    },
    [expireToast, startStayTimer],
  );

  const selectAction = useCallback(
    (id: number, action: ToastAction) => {
      const timerState = timerStateRef.current;
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
      <ToastViewContext.Provider
        value={{
          toast,
          onEntered,
          onEntryComplete: completeEntry,
          onActionStart: startActionInteraction,
          onActionEnd: endActionInteraction,
          onActionSelect: selectAction,
          onDismiss: dismissToast,
        }}
      >
        {children}
      </ToastViewContext.Provider>
    </ToastContext.Provider>
  );
}

/** ヘッダー直下。保存バー・タブ・戻るを覆わない。 */
export function ToastHost() {
  const view = useContext(ToastViewContext);
  if (!view?.toast) {
    return null;
  }
  return (
    <div className="app-toast-slot">
      <ToastCard
        key={view.toast.id}
        toast={view.toast}
        onEntered={view.onEntered}
        onEntryComplete={view.onEntryComplete}
        onActionStart={view.onActionStart}
        onActionEnd={view.onActionEnd}
        onActionSelect={view.onActionSelect}
        onDismiss={view.onDismiss}
      />
    </div>
  );
}

function ToastCard({
  toast,
  onEntered,
  onEntryComplete,
  onActionStart,
  onActionEnd,
  onActionSelect,
  onDismiss,
}: {
  toast: ToastState;
  onEntered: (id: number) => void;
  onEntryComplete: (id: number) => void;
  onActionStart: (id: number) => void;
  onActionEnd: (id: number) => void;
  onActionSelect: (id: number, action: ToastAction) => void;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const cheer = toast.cheer ?? toastShowsCheer(toast.message);
  const entryCompleteRef = useRef(false);

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
    entryCompleteRef.current = false;
    const fallback = window.setTimeout(
      () => {
        if (!entryCompleteRef.current) {
          entryCompleteRef.current = true;
          onEntryComplete(toast.id);
        }
      },
      reduceMotion ? MOTION_MS.toastOut : MOTION_MS.toastIn,
    );
    return () => window.clearTimeout(fallback);
  }, [onEntryComplete, reduceMotion, toast.id]);

  function markEntryComplete() {
    if (entryCompleteRef.current) {
      return;
    }
    entryCompleteRef.current = true;
    onEntryComplete(toast.id);
  }

  function bindActionHandlers() {
    return {
      onPointerEnter: () => onActionStart(toast.id),
      onPointerDown: () => onActionStart(toast.id),
      onFocus: () => onActionStart(toast.id),
      onPointerLeave: () => onActionEnd(toast.id),
      onPointerCancel: () => onActionEnd(toast.id),
      onBlur: () => onActionEnd(toast.id),
    };
  }

  return (
    <div
      className="app-toast"
      data-state={toast.phase === "idle" ? undefined : toast.phase}
      role="status"
      aria-live="polite"
      onTransitionEnd={(event) => {
        if (
          toast.phase === "idle" &&
          event.target === event.currentTarget &&
          event.propertyName === "opacity"
        ) {
          markEntryComplete();
        }
      }}
    >
      {cheer ? <Mascot pose="cheer" size={32} pour={!reduceMotion} aria-hidden /> : null}
      <p className="app-toast-message">{toast.message}</p>
      {toast.action ? (
        <>
          <button
            type="button"
            className="app-toast-action"
            tabIndex={0}
            {...bindActionHandlers()}
            onClick={() => {
              if (toast.action) {
                onActionSelect(toast.id, toast.action);
              }
            }}
          >
            {toast.action.label}
          </button>
          <button
            type="button"
            className="app-toast-close"
            aria-label="閉じる"
            {...bindActionHandlers()}
            onClick={onDismiss}
          >
            閉じる
          </button>
        </>
      ) : null}
    </div>
  );
}
