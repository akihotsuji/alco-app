import { requestAppReload } from "@/client/lib/app-reload.ts";
import { notifySwUpdateAvailable, shouldReloadOnControllerChange } from "@/client/lib/sw-update.ts";
import { PWA_SW_FILENAME } from "@/shared/pwa.ts";

export function shouldRegisterServiceWorker(prod: boolean, hasServiceWorker: boolean): boolean {
  return prod && hasServiceWorker;
}

/** 本番ビルドだけ SW を登録する。Vite 開発では HMR を邪魔しない。インライン script は使わない（CSP） */
export function installServiceWorker(
  deps: {
    prod?: boolean;
    hasServiceWorker?: boolean;
    register?: (url: string, options?: RegistrationOptions) => Promise<unknown>;
    addControllerChangeListener?: (listener: () => void) => void;
    hadControllerAtStart?: boolean;
    onRegisterError?: (error: unknown) => void;
  } = {},
): void {
  const prod = deps.prod ?? import.meta.env.PROD;
  const hasServiceWorker = deps.hasServiceWorker ?? "serviceWorker" in navigator;
  if (!shouldRegisterServiceWorker(prod, hasServiceWorker)) {
    return;
  }
  const hadControllerAtStart =
    deps.hadControllerAtStart ?? Boolean(navigator.serviceWorker.controller);

  const onControllerChange = () => {
    if (!shouldReloadOnControllerChange(hadControllerAtStart)) {
      return;
    }
    const decision = requestAppReload("sw-update", {
      notifyDirty: () => notifySwUpdateAvailable(),
    });
    if (decision === "skip-loop") {
      notifySwUpdateAvailable();
    }
  };

  if (deps.addControllerChangeListener) {
    deps.addControllerChangeListener(onControllerChange);
  } else {
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  }

  const register =
    deps.register ??
    ((url: string, options?: RegistrationOptions) =>
      navigator.serviceWorker.register(url, options));
  void register(`/${PWA_SW_FILENAME}`, { updateViaCache: "none" }).catch((error: unknown) => {
    deps.onRegisterError?.(error);
  });
}
