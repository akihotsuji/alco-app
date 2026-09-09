/** 起動・復旧の待ち時間と文言。画面の正本は spec/screen-designs/00-common.md 2.10 */

export const AUTH_FETCH_TIMEOUT_MS = 10_000;
export const AUTH_BOOT_SLOW_MS = 8_000;
export const EARLY_FETCH_TIMEOUT_MS = 10_000;
export const APP_RELOAD_COOLDOWN_MS = 15_000;

export const BOOT_COPY = {
  loading: "読み込み中",
  slow: "読み込みに時間がかかっています",
  failed: "読み込めませんでした",
  retry: "再試行",
  updateAvailable: "新しいバージョンがあります",
  updateAction: "更新",
} as const;

export const APP_RELOAD_STORAGE_KEY = "alco.boot.reload";
export const ASSET_RECOVERY_STORAGE_KEY = "alco.boot.asset-reload";
export const SW_UPDATE_EVENT = "alco-sw-update-available";
