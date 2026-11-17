import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import { clearAppBadge } from "@/client/lib/app-badge.ts";
import { clearReloadGuard } from "@/client/lib/app-reload.ts";
import { clearAssetRecoveryGuard } from "@/client/lib/asset-recovery.ts";
import { authClient } from "@/client/lib/auth-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { clearPersistedQueries } from "@/client/lib/query-persist.ts";
import { AuthBoot } from "./AuthBoot.tsx";
import { loginPathFor } from "./login-path.ts";
import { PersistedQueries } from "./PersistedQueries.tsx";

export function RequireAuth() {
  const boot = useSessionBoot();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (boot.kind === "guest") {
      queryClient.clear();
      clearPersistedQueries();
      void clearAppBadge();
    }
    if (boot.kind === "authenticated" || boot.kind === "guest") {
      clearReloadGuard();
      clearAssetRecoveryGuard();
    }
  }, [boot.kind, queryClient]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }
      authClient.$store.notify("$sessionSignal");
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient]);

  if (boot.variant) {
    return <AuthBoot variant={boot.variant} onRetry={boot.retry} retrying={boot.retrying} />;
  }
  if (boot.kind === "guest") {
    return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
  }
  return (
    <Suspense fallback={<AuthBoot />}>
      {boot.userId ? (
        <PersistedQueries key={boot.userId} userId={boot.userId}>
          <Outlet />
        </PersistedQueries>
      ) : (
        <Outlet />
      )}
    </Suspense>
  );
}
