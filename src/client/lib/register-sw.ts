import { registerSW } from "virtual:pwa-register";

/** 本番ビルドだけ SW を登録する。Vite 開発では HMR を邪魔しない */
export function installServiceWorker(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  registerSW({ immediate: true });
}
