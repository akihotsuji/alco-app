import { Suspense, useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import { clearReloadGuard } from "@/client/lib/app-reload.ts";
import { clearAssetRecoveryGuard } from "@/client/lib/asset-recovery.ts";
import { AuthBoot } from "./AuthBoot.tsx";

export function GuestOnly() {
  const boot = useSessionBoot();

  useEffect(() => {
    if (boot.kind === "authenticated" || boot.kind === "guest") {
      clearReloadGuard();
      clearAssetRecoveryGuard();
    }
  }, [boot.kind]);

  if (boot.variant) {
    return <AuthBoot variant={boot.variant} onRetry={boot.retry} retrying={boot.retrying} />;
  }
  if (boot.kind === "authenticated") {
    return <Navigate to="/" replace />;
  }
  return (
    <Suspense fallback={<AuthBoot />}>
      <Outlet />
    </Suspense>
  );
}
