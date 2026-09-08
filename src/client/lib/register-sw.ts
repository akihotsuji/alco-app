import { PWA_SW_FILENAME } from "@/shared/pwa.ts";

export function shouldRegisterServiceWorker(prod: boolean, hasServiceWorker: boolean): boolean {
  return prod && hasServiceWorker;
}

/** 本番ビルドだけ SW を登録する。Vite 開発では HMR を邪魔しない。インライン script は使わない（CSP） */
export function installServiceWorker(): void {
  if (!shouldRegisterServiceWorker(import.meta.env.PROD, "serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
  void navigator.serviceWorker.register(`/${PWA_SW_FILENAME}`);
}
