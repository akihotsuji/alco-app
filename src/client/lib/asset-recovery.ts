import { requestAppReload } from "@/client/lib/app-reload.ts";
import { ASSET_RECOVERY_STORAGE_KEY } from "@/client/lib/boot.ts";

export type AssetRecoveryDecision = "reload" | "ui-offline" | "ui-repeat";

export function decideAssetRecovery(input: {
  online: boolean;
  alreadyReloaded: boolean;
}): AssetRecoveryDecision {
  if (!input.online) {
    return "ui-offline";
  }
  if (input.alreadyReloaded) {
    return "ui-repeat";
  }
  return "reload";
}

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Unable to preload") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

type AssetRecoveryListener = (decision: AssetRecoveryDecision) => void;

const listeners = new Set<AssetRecoveryListener>();

export function subscribeAssetRecovery(listener: AssetRecoveryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAssetRecovery(decision: AssetRecoveryDecision): void {
  for (const listener of listeners) {
    listener(decision);
  }
}

export function recoverFromAssetFailure(
  deps: {
    online?: boolean;
    storage?: Pick<Storage, "getItem" | "setItem">;
    reload?: () => void;
  } = {},
): AssetRecoveryDecision {
  const storage = deps.storage ?? sessionStorage;
  const decision = decideAssetRecovery({
    online: deps.online ?? (typeof navigator === "undefined" || navigator.onLine),
    alreadyReloaded: storage.getItem(ASSET_RECOVERY_STORAGE_KEY) === "1",
  });
  if (decision === "reload") {
    storage.setItem(ASSET_RECOVERY_STORAGE_KEY, "1");
    requestAppReload("asset", { reload: deps.reload, storage });
    return decision;
  }
  notifyAssetRecovery(decision);
  return decision;
}

export function clearAssetRecoveryGuard(
  storage: Pick<Storage, "removeItem"> = sessionStorage,
): void {
  storage.removeItem(ASSET_RECOVERY_STORAGE_KEY);
}

export function installAssetRecovery(): () => void {
  const onPreload = (event: Event) => {
    event.preventDefault();
    recoverFromAssetFailure();
  };
  window.addEventListener("vite:preloadError", onPreload);
  return () => {
    window.removeEventListener("vite:preloadError", onPreload);
  };
}
