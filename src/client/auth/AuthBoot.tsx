import { useEffect, useState } from "react";
import { Button } from "@/client/components/ui/button.tsx";
import { requestAppReload } from "@/client/lib/app-reload.ts";
import { AUTH_BOOT_SLOW_MS, BOOT_COPY } from "@/client/lib/boot.ts";

export type AuthBootVariant = "loading" | "slow" | "failed";

type AuthBootProps = {
  variant?: AuthBootVariant;
  onRetry?: () => void;
  retrying?: boolean;
};

export function AuthBoot({ variant, onRetry, retrying = false }: AuthBootProps) {
  const [localSlow, setLocalSlow] = useState(false);

  useEffect(() => {
    if (variant && variant !== "loading") {
      return;
    }
    const timer = window.setTimeout(() => {
      setLocalSlow(true);
    }, AUTH_BOOT_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  const resolved: AuthBootVariant = variant ?? (localSlow ? "slow" : "loading");
  const message =
    resolved === "failed"
      ? BOOT_COPY.failed
      : resolved === "slow"
        ? BOOT_COPY.slow
        : BOOT_COPY.loading;
  const showRetry = resolved !== "loading";

  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }
    requestAppReload("user");
  }

  return (
    <div className="auth-boot" data-variant={resolved}>
      <p className="auth-boot-status" role={resolved === "loading" ? "status" : "alert"}>
        {message}
      </p>
      {showRetry ? (
        <Button type="button" variant="secondary" onClick={handleRetry} disabled={retrying}>
          {BOOT_COPY.retry}
        </Button>
      ) : null}
    </div>
  );
}
