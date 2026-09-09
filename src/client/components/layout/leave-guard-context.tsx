import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from "react";
import { setLeaveGuardRegistered } from "@/client/lib/leave-guard-state.ts";

/**
 * 「戻る」を横取りして確認を挟むための小さな契約。フォーム画面が未保存のときだけ guard を登録し、
 * ヘッダーの戻るボタンは `requestLeave(proceed)` を通す。guard は確認後に `proceed()` を呼ぶ。
 */
export type LeaveGuard = (proceed: () => void) => void;

type LeaveGuardValue = {
  setGuard: (guard: LeaveGuard | null) => void;
  requestLeave: (proceed: () => void) => void;
};

const LeaveGuardContext = createContext<LeaveGuardValue>({
  setGuard: () => {},
  requestLeave: (proceed) => proceed(),
});

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<LeaveGuard | null>(null);

  const setGuard = useCallback((guard: LeaveGuard | null) => {
    guardRef.current = guard;
    setLeaveGuardRegistered(guard !== null);
  }, []);

  const requestLeave = useCallback((proceed: () => void) => {
    const guard = guardRef.current;
    if (guard) {
      guard(proceed);
      return;
    }
    proceed();
  }, []);

  const value = useMemo(() => ({ setGuard, requestLeave }), [setGuard, requestLeave]);
  return <LeaveGuardContext.Provider value={value}>{children}</LeaveGuardContext.Provider>;
}

export function useLeaveGuard(): LeaveGuardValue {
  return useContext(LeaveGuardContext);
}
