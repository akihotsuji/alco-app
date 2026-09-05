export const TOAST_DURATION_MS = 5_000;

export const TOAST_MESSAGES = {
  logged: "記録しました",
  saved: "保存しました",
  consumed: "貯蔵庫へ移しました",
  deleted: "削除しました",
  saveFailed: "保存できませんでした。もう一度試してください",
} as const;

const SUCCESS_WITH_CHEER = new Set<string>([
  TOAST_MESSAGES.logged,
  TOAST_MESSAGES.saved,
  TOAST_MESSAGES.consumed,
  TOAST_MESSAGES.deleted,
]);

export function toastShowsCheer(message: string): boolean {
  return SUCCESS_WITH_CHEER.has(message);
}

export type ToastAction = {
  label: string;
  onSelect: () => void;
};

export type ToastInput = {
  message: string;
  action?: ToastAction;
};
