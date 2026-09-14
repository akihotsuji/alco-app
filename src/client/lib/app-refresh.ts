import { claimAppReload, type ReloadDecision, type ReloadReason } from "@/client/lib/app-reload.ts";
import { APP_REFRESH_UPDATE_TIMEOUT_MS } from "@/shared/app-version.ts";

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

export async function waitForActivatedServiceWorker(
  deps: { hasController?: boolean; getReady?: () => Promise<unknown> } = {},
): Promise<void> {
  const hasController =
    deps.hasController ??
    (typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      Boolean(navigator.serviceWorker.controller));
  if (!hasController) {
    return;
  }
  const getReady = deps.getReady ?? (() => navigator.serviceWorker.ready);
  try {
    await getReady();
  } catch {
    // 有効化待ちの失敗では再読み込み自体は続ける
  }
}

export function currentDocumentUrl(
  location: Pick<Location, "pathname" | "search" | "hash">,
): string {
  const pathname = location.pathname.startsWith("/") ? location.pathname : "/";
  const search = location.search.startsWith("?") || location.search === "" ? location.search : "";
  const hash = location.hash.startsWith("#") || location.hash === "" ? location.hash : "";
  return `${pathname}${search}${hash}`;
}

export function replaceCurrentDocument(
  deps: {
    location?: Pick<Location, "pathname" | "search" | "hash">;
    replace?: (url: string) => void;
  } = {},
): void {
  const location = deps.location ?? window.location;
  const replace = deps.replace ?? ((url) => window.location.replace(url));
  replace(currentDocumentUrl(location));
}

export async function refreshAppToLatest(
  deps: {
    online?: boolean;
    claimReload?: (reason: ReloadReason) => ReloadDecision;
    updateRegistrations?: () => Promise<void>;
    waitForActivated?: () => Promise<void>;
    reload?: () => void;
    timeoutMs?: number;
  } = {},
): Promise<AppRefreshResult> {
  const online = deps.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) {
    return "offline";
  }
  const claimReload = deps.claimReload ?? ((reason) => claimAppReload(reason));
  if (claimReload("user") !== "reload") {
    return "reload";
  }
  const timeoutMs = deps.timeoutMs ?? APP_REFRESH_UPDATE_TIMEOUT_MS;
  await waitWithTimeout(
    (async () => {
      await (deps.updateRegistrations ?? updateServiceWorkerRegistrations)();
      await (deps.waitForActivated ?? waitForActivatedServiceWorker)();
    })(),
    timeoutMs,
  );
  (deps.reload ?? replaceCurrentDocument)();
  return "reload";
}
