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
import { hidesTabBar } from "@/client/lib/app-routes.ts";
import { TOAST_DURATION_MS, type ToastInput, toastShowsCheer } from "@/client/lib/toast.ts";

type ToastState = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast は ToastProvider の内側で使う");
  }
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((input: ToastInput) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    idRef.current += 1;
    setToast({ ...input, id: idRef.current });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast }: { toast: ToastState }) {
  const location = useLocation();
  const photoEdit = usePhotoEdit();
  const tabsHidden = hidesTabBar(location.pathname, photoEdit.open);
  const cheer = toastShowsCheer(toast.message);

  return (
    <div
      className={tabsHidden ? "app-toast app-toast-no-tabs" : "app-toast"}
      role="status"
      aria-live="polite"
    >
      {cheer ? <Mascot pose="cheer" size={32} aria-hidden /> : null}
      <p className="app-toast-message">{toast.message}</p>
      {toast.action ? (
        <button type="button" className="app-toast-action" onClick={toast.action.onSelect}>
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
