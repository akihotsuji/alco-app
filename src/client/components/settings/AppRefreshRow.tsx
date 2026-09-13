import { useState } from "react";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { refreshAppToLatest } from "@/client/lib/app-refresh.ts";
import { APP_REFRESH_COPY } from "@/shared/app-version.ts";

export function AppRefreshRow() {
  const { requestLeave } = useLeaveGuard();
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);

  return (
    <button
      type="button"
      className="settings-row settings-row-stack"
      disabled={pending}
      onClick={() => {
        requestLeave(() => {
          void (async () => {
            setOffline(false);
            setPending(true);
            const result = await refreshAppToLatest();
            if (result === "offline") {
              setOffline(true);
              setPending(false);
            }
          })();
        });
      }}
    >
      <span className="settings-row-main">
        <span>{pending ? APP_REFRESH_COPY.pending : APP_REFRESH_COPY.label}</span>
      </span>
      <span className="settings-caption">{APP_REFRESH_COPY.caption}</span>
      {offline ? <span className="settings-error">{APP_REFRESH_COPY.offline}</span> : null}
    </button>
  );
}
