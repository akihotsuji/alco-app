import { readClientBuildId } from "@/client/lib/app-version.ts";
import { notifySwUpdateAvailable } from "@/client/lib/sw-update.ts";
import {
  APP_VERSION_PATH,
  type AppVersionManifest,
  parseAppVersionManifest,
  shouldNotifyPublishedUpdate,
  shouldRunVersionCheck,
  VERSION_WATCH_MIN_INTERVAL_MS,
} from "@/shared/app-version.ts";

export async function fetchPublishedAppVersion(
  fetchImpl: typeof fetch = fetch,
): Promise<AppVersionManifest | null> {
  try {
    const response = await fetchImpl(APP_VERSION_PATH, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("text/html")) {
      return null;
    }
    return parseAppVersionManifest(await response.json());
  } catch {
    return null;
  }
}

export async function checkPublishedAppVersion(
  deps: {
    now?: number;
    lastAt?: number | null;
    intervalMs?: number;
    currentBuildId?: string;
    fetchManifest?: () => Promise<AppVersionManifest | null>;
    notify?: () => void;
  } = {},
): Promise<{ notified: boolean; lastAt: number | null }> {
  const now = deps.now ?? Date.now();
  const lastAt = deps.lastAt ?? null;
  const intervalMs = deps.intervalMs ?? VERSION_WATCH_MIN_INTERVAL_MS;
  if (!shouldRunVersionCheck(lastAt, now, intervalMs)) {
    return { notified: false, lastAt };
  }
  const published = await (deps.fetchManifest ?? fetchPublishedAppVersion)();
  const currentBuildId = deps.currentBuildId ?? readClientBuildId();
  if (!shouldNotifyPublishedUpdate(currentBuildId, published)) {
    return { notified: false, lastAt: now };
  }
  (deps.notify ?? notifySwUpdateAvailable)();
  return { notified: true, lastAt: now };
}

export function installVersionWatch(
  deps: {
    addVisibleListener?: (listener: () => void) => void;
    check?: () => Promise<unknown>;
  } = {},
): () => void {
  let lastAt: number | null = null;

  const run = () => {
    void checkPublishedAppVersion({
      lastAt,
      notify: () => notifySwUpdateAvailable(),
    }).then((result) => {
      lastAt = result.lastAt;
    });
    deps.check?.();
  };

  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    run();
  };

  if (deps.addVisibleListener) {
    deps.addVisibleListener(onVisible);
    run();
    return () => undefined;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisible);
  }
  run();
  return () => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}
