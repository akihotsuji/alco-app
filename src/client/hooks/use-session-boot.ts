import { useEffect, useRef, useState } from "react";
import {
  authBootVariant,
  resolveSessionBoot,
  type SessionBootKind,
} from "@/client/auth/session-boot.ts";
import { authClient } from "@/client/lib/auth-client.ts";
import { AUTH_BOOT_SLOW_MS } from "@/client/lib/boot.ts";

export function useSessionBoot() {
  const session = authClient.useSession();
  const startedRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!session.isPending && !session.isRefetching) {
      return;
    }
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedRef.current);
    }, 500);
    return () => window.clearInterval(id);
  }, [session.isPending, session.isRefetching]);

  const kind: SessionBootKind = resolveSessionBoot({
    isPending: session.isPending,
    isRefetching: session.isRefetching,
    hasSession: Boolean(session.data),
    error: session.error,
    elapsedMs,
    slowAfterMs: AUTH_BOOT_SLOW_MS,
  });

  function retry() {
    startedRef.current = Date.now();
    setElapsedMs(0);
    void session.refetch();
  }

  return {
    kind,
    variant: authBootVariant(kind),
    retry,
    retrying: session.isRefetching,
  };
}
