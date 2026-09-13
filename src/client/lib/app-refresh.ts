import { type ReloadDecision, requestAppReload } from "@/client/lib/app-reload.ts";
import { APP_REFRESH_UPDATE_TIMEOUT_MS, isForceRefreshCacheKey } from "@/shared/app-version.ts";

export type AppRefreshResult = "reload" | "offline";

export async function waitWithTimeout(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function updateServiceWorkerRegistrations(
  getRegistrations: () => Promise<readonly { update: () => Promise<unknown> }[]> = () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return Promise.resolve([]);
    }
    return navigator.serviceWorker.getRegistrations();
  },
): Promise<void> {
  const registrations = await getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.update().catch(() => undefined)),
  );
}

export async function clearWorkboxPrecaches(
  listKeys: () => Promise<string[]> = () =>
    typeof caches === "undefined" ? Promise.resolve([]) : caches.keys(),
  deleteKey: (key: string) => Promise<boolean> = (key) => caches.delete(key),
): Promise<void> {
  const keys = await listKeys();
  await Promise.all(keys.filter(isForceRefreshCacheKey).map((key) => deleteKey(key)));
}

export async function refreshAppToLatest(
  deps: {
    online?: boolean;
    updateRegistrations?: () => Promise<void>;
    clearStalePrecaches?: () => Promise<void>;
    reload?: () => ReloadDecision;
    timeoutMs?: number;
  } = {},
): Promise<AppRefreshResult> {
  const online = deps.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) {
    return "offline";
  }
  const timeoutMs = deps.timeoutMs ?? APP_REFRESH_UPDATE_TIMEOUT_MS;
  await waitWithTimeout(
    (deps.updateRegistrations ?? updateServiceWorkerRegistrations)(),
    timeoutMs,
  );
  await (deps.clearStalePrecaches ?? clearWorkboxPrecaches)();
  (deps.reload ?? (() => requestAppReload("user")))();
  return "reload";
}
