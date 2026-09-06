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
import { hidesTabBar } from "@/client/lib/app-routes.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { TOAST_DURATION_MS, type ToastInput, toastShowsCheer } from "@/client/lib/toast.ts";

type ToastPhase = "enter" | "idle" | "leave";

type ToastState = ToastInput & { id: number; phase: ToastPhase };

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

  const showToast = useCallback(
    (input: ToastInput) => {
      clearTimers();
      idRef.current += 1;
      const id = idRef.current;
      const mount = () => {
        setToast({ ...input, id, phase: "enter" });
        stayTimer.current = setTimeout(() => {
          stayTimer.current = null;
          beginLeave(() => setToast(null));
        }, TOAST_DURATION_MS);
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

  const dismissToast = useCallback(() => {
    clearTimers();
    beginLeave(() => setToast(null));
  }, [beginLeave, clearTimers]);

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
      {toast ? <ToastCard key={toast.id} toast={toast} onEntered={onEntered} /> : null}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onEntered }: { toast: ToastState; onEntered: (id: number) => void }) {
  const location = useLocation();
  const photoEdit = usePhotoEdit();
  const reduceMotion = useReducedMotion();
  const tabsHidden = hidesTabBar(location.pathname, photoEdit.open);
  const cheer = toastShowsCheer(toast.message);

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

  return (
    <div
      className={tabsHidden ? "app-toast app-toast-no-tabs" : "app-toast"}
      data-state={toast.phase === "idle" ? undefined : toast.phase}
      role="status"
      aria-live="polite"
    >
      {cheer ? <Mascot pose="cheer" size={32} pour={!reduceMotion} aria-hidden /> : null}
      <p className="app-toast-message">{toast.message}</p>
      {toast.action ? (
        <button type="button" className="app-toast-action" onClick={toast.action.onSelect}>
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
