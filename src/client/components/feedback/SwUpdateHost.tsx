import { useEffect } from "react";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { refreshAppToLatest } from "@/client/lib/app-refresh.ts";
import { BOOT_COPY, SW_UPDATE_EVENT } from "@/client/lib/boot.ts";

export function SwUpdateHost() {
  const { showToast } = useToast();
  const { requestLeave } = useLeaveGuard();

  useEffect(() => {
    function onUpdate() {
      showToast({
        message: BOOT_COPY.updateAvailable,
        cheer: false,
        action: {
          label: BOOT_COPY.updateAction,
          onSelect: () => {
            requestLeave(() => {
              void refreshAppToLatest();
            });
          },
        },
      });
    }
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, [requestLeave, showToast]);

  return null;
}
