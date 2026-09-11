import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCellarRevision } from "@/client/hooks/use-cellars.ts";
import { isRecentLocalCellarWrite } from "@/client/lib/cellar-share.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";
import { CELLAR_REVISION_POLL_MS } from "@/shared/constants.ts";

export type CellarSyncNotice = {
  kind: "updated" | "failed";
  message: string;
};

/**
 * 前景の共有セラー画面で revision を 5 秒間隔で確認する。
 * 非表示・オフラインは止め、復帰とセラー変更では即時確認する。
 */
export function useCellarSync(cellarId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<CellarSyncNotice | null>(null);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const active = Boolean(cellarId) && enabled && visible && online;
  const revision = useQuery({
    queryKey: queryKeys.cellarRevision(cellarId ?? ""),
    queryFn: () => getCellarRevision(cellarId ?? ""),
    enabled: active,
    refetchInterval: active ? CELLAR_REVISION_POLL_MS : false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  useEffect(() => {
    if (revision.isError && active) {
      setNotice({ kind: "failed", message: CELLAR_COPY.syncFailed });
    }
  }, [active, revision.isError]);

  useEffect(() => {
    const data = revision.data;
    if (!data || !cellarId) {
      return;
    }
    const key = `cellar.revision.${cellarId}`;
    const previous = sessionStorage.getItem(key);
    sessionStorage.setItem(key, String(data.revision));
    if (previous === null || previous === String(data.revision)) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cellar(cellarId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cellarMembers(cellarId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cellarsList });
    if (!isRecentLocalCellarWrite()) {
      setNotice({ kind: "updated", message: CELLAR_COPY.updated });
    }
  }, [cellarId, queryClient, revision.data]);

  return {
    notice,
    retry: () => {
      setNotice(null);
      void revision.refetch();
    },
    clearNotice: () => setNotice(null),
    revision: revision.data?.revision,
  };
}
