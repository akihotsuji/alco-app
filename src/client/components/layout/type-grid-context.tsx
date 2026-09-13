import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TYPE_GRID_HISTORY_FLAG } from "@/client/lib/cellar-shelf.ts";
import { historyHasFlag, withHistoryFlag } from "@/client/lib/history-state.ts";
import type { DrinkType } from "@/shared/constants.ts";

export type TypeGridSession = {
  drinkType: DrinkType;
  cellarId?: string;
  searchActive: boolean;
  q?: string;
  count: number;
};

type TypeGridValue = {
  open: boolean;
  session: TypeGridSession | null;
  openGrid: (session: TypeGridSession) => void;
  requestClose: () => void;
  registerCloseHandler: (handler: (() => Promise<boolean>) | null) => void;
};

const TypeGridContext = createContext<TypeGridValue>({
  open: false,
  session: null,
  openGrid: () => {},
  requestClose: () => {},
  registerCloseHandler: () => {},
});

export function TypeGridProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TypeGridSession | null>(null);
  const open = session !== null;
  const openRef = useRef(open);
  openRef.current = open;
  const closeHandlerRef = useRef<(() => Promise<boolean>) | null>(null);
  const closingCleanRef = useRef(false);

  const finishClose = useCallback(() => {
    closingCleanRef.current = false;
    setSession(null);
  }, []);

  const registerCloseHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    closeHandlerRef.current = handler;
  }, []);

  const requestClose = useCallback(() => {
    void (async () => {
      const ok = closeHandlerRef.current ? await closeHandlerRef.current() : true;
      if (!ok) {
        return;
      }
      if (historyHasFlag(window.history.state, TYPE_GRID_HISTORY_FLAG)) {
        closingCleanRef.current = true;
        window.history.back();
        return;
      }
      finishClose();
    })();
  }, [finishClose]);

  const openGrid = useCallback((next: TypeGridSession) => {
    setSession(next);
    if (!historyHasFlag(window.history.state, TYPE_GRID_HISTORY_FLAG)) {
      window.history.pushState(withHistoryFlag(window.history.state, TYPE_GRID_HISTORY_FLAG), "");
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      if (closingCleanRef.current) {
        finishClose();
        return;
      }
      if (!openRef.current) {
        return;
      }
      if (historyHasFlag(window.history.state, TYPE_GRID_HISTORY_FLAG)) {
        return;
      }
      void (async () => {
        const ok = closeHandlerRef.current ? await closeHandlerRef.current() : true;
        if (!ok) {
          window.history.pushState(
            withHistoryFlag(window.history.state, TYPE_GRID_HISTORY_FLAG),
            "",
          );
          return;
        }
        finishClose();
      })();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [finishClose]);

  const value = useMemo<TypeGridValue>(
    () => ({
      open,
      session,
      openGrid,
      requestClose,
      registerCloseHandler,
    }),
    [open, openGrid, registerCloseHandler, requestClose, session],
  );

  return <TypeGridContext.Provider value={value}>{children}</TypeGridContext.Provider>;
}

export function useTypeGrid(): TypeGridValue {
  return useContext(TypeGridContext);
}
