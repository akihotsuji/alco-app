import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMe } from "@/client/hooks/use-me.ts";
import { api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import {
  detectPushSupport,
  disablePushOnDevice,
  type EnablePushResult,
  enablePushOnDevice,
  getDevicePushSubscription,
  type PushApi,
  readPushPermission,
  resyncPushSubscription,
} from "@/client/lib/web-push.ts";

export const pushApi: PushApi = {
  save: async (body) => {
    await unwrap(api.api.push.subscription.$put({ json: body }));
  },
  remove: async (endpoint) => {
    await unwrap(api.api.push.subscription.$delete({ json: { endpoint } }));
  },
};

/** 年齢確認前は API が 403 なので取りに行かない */
export function usePushConfig() {
  const me = useMe();
  return useQuery({
    queryKey: queryKeys.pushConfig,
    queryFn: () => unwrap(api.api.push.config.$get()),
    enabled: me.data?.ageVerified === true,
    staleTime: 5 * 60_000,
  });
}

/**
 * 設定 S23 と通知画面 N1 が共有する状態。`enable` はクリックハンドラから同期的に呼ぶ
 * （中の最初の await が許可の要求。iOS はユーザー操作の中でしか許可を出せない）。
 */
export function usePushNotifications() {
  const config = usePushConfig();
  const support = useMemo(() => detectPushSupport(), []);
  const [permission, setPermission] = useState(() => readPushPermission());
  const [subscribed, setSubscribed] = useState<boolean | null>(
    support === "supported" ? null : false,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (support !== "supported") {
      return;
    }
    let alive = true;
    void getDevicePushSubscription().then((subscription) => {
      if (alive) {
        setSubscribed(Boolean(subscription));
      }
    });
    return () => {
      alive = false;
    };
  }, [support]);

  const publicKey = config.data?.publicKey ?? null;

  const enable = useCallback(async (): Promise<EnablePushResult> => {
    if (!publicKey) {
      return "unsupported";
    }
    setBusy(true);
    setFailed(false);
    const result = await enablePushOnDevice({ publicKey, api: pushApi });
    setPermission(readPushPermission());
    setSubscribed(result === "enabled" ? true : Boolean(await getDevicePushSubscription()));
    setFailed(result === "failed");
    setBusy(false);
    return result;
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    const result = await disablePushOnDevice({ api: pushApi });
    setSubscribed(Boolean(await getDevicePushSubscription()));
    setFailed(result === "failed");
    setBusy(false);
  }, []);

  return {
    support,
    configLoaded: config.isSuccess,
    available: config.data?.available === true,
    permission,
    subscribed,
    on: permission === "granted" && subscribed === true,
    busy,
    failed,
    enable,
    disable,
  };
}

let resyncedThisSession = false;

/** 認証後シェルで 1 セッション 1 回。許可済み・購読ありの端末だけ保存し直す（許可は求めない） */
export function usePushResync(): void {
  const config = usePushConfig();
  const publicKey = config.data?.available ? config.data.publicKey : null;
  useEffect(() => {
    if (!publicKey || resyncedThisSession) {
      return;
    }
    resyncedThisSession = true;
    void resyncPushSubscription({ publicKey, api: pushApi });
  }, [publicKey]);
}
