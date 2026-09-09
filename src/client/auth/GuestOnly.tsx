import { Suspense, useEffect, useRef } from "react";
import { Navigate, Outlet } from "react-router";
import { useSessionBoot } from "@/client/hooks/use-session-boot.ts";
import { clearReloadGuard } from "@/client/lib/app-reload.ts";
import { clearAssetRecoveryGuard } from "@/client/lib/asset-recovery.ts";
import { AuthBoot } from "./AuthBoot.tsx";
import { resolveGuestOnlyContent } from "./guest-only-content.ts";

export function GuestOnly() {
  const boot = useSessionBoot();
  const settledAsGuestRef = useRef(false);
  if (boot.kind === "guest") {
    settledAsGuestRef.current = true;
  }
  const content = resolveGuestOnlyContent({
    kind: boot.kind,
    hasBootVariant: Boolean(boot.variant),
    settledAsGuest: settledAsGuestRef.current,
  });

  useEffect(() => {
    if (boot.kind === "authenticated" || boot.kind === "guest") {
      clearReloadGuard();
      clearAssetRecoveryGuard();
    }
  }, [boot.kind]);

  if (content === "boot") {
    return (
      <AuthBoot variant={boot.variant ?? undefined} onRetry={boot.retry} retrying={boot.retrying} />
    );
  }
  if (content === "redirect") {
    return <Navigate to="/" replace />;
  }
  return (
    <Suspense fallback={<AuthBoot />}>
      <Outlet />
    </Suspense>
  );
}
