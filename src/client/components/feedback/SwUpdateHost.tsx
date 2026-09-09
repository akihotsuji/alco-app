import { useEffect } from "react";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { requestAppReload } from "@/client/lib/app-reload.ts";
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
              requestAppReload("user");
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
