export const TOAST_DURATION_MS = 5_000;

export const TOAST_MESSAGES = {
  logged: "記録しました",
  saved: "保存しました",
  opened: "開栓しました",
  deleted: "削除しました",
  saveFailed: "保存できませんでした。もう一度試してください",
} as const;

const SUCCESS_WITH_CHEER = new Set<string>([
  TOAST_MESSAGES.logged,
  TOAST_MESSAGES.saved,
  TOAST_MESSAGES.opened,
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
  /** 削除など、仕様上キャラクターを出さない成功通知では false。 */
  cheer?: boolean;
};

export type ToastTimerState = "entering" | "running" | "interacting" | "expired" | "selected";
export type ToastTimerEvent = "entry-complete" | "interaction-start" | "timeout" | "select";
export type ToastTimerEffect = "none" | "start-timer" | "dismiss" | "select";

export type ToastTimerTransition = {
  state: ToastTimerState;
  effect: ToastTimerEffect;
};

/**
 * アクション操作の開始後は click が完了するまで期限切れにしない。
 * effect を分離し、タイマーとイベントの競合を React 外で決定的に検証できるようにする。
 */
export function transitionToastTimer(
  state: ToastTimerState,
  event: ToastTimerEvent,
): ToastTimerTransition {
  if (state === "expired" || state === "selected") {
    return { state, effect: "none" };
  }
  if (event === "entry-complete") {
    return state === "entering"
      ? { state: "running", effect: "start-timer" }
      : { state, effect: "none" };
  }
  if (event === "interaction-start") {
    return { state: "interacting", effect: "none" };
  }
  if (event === "timeout") {
    return state === "interacting"
      ? { state, effect: "none" }
      : { state: "expired", effect: "dismiss" };
  }
  return { state: "selected", effect: "select" };
}
