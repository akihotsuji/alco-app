export const TOAST_DURATION_MS = 2_500;
export const TOAST_ACTION_DURATION_MS = 6_000;

export function toastStayMs(hasAction: boolean): number {
  return hasAction ? TOAST_ACTION_DURATION_MS : TOAST_DURATION_MS;
}

export function remainingToastMs(startedAt: number, durationMs: number, now: number): number {
  return Math.max(0, durationMs - (now - startedAt));
}

export const TOAST_MESSAGES = {
  logged: "記録しました",
  saved: "保存しました",
  opened: "開栓しました",
  undone: "元に戻しました",
  returned: "開栓の記録を取り消しました",
  deleted: "削除しました",
  saveFailed: "保存できませんでした。もう一度試してください",
  updateAvailable: "新しいバージョンがあります",
} as const;

const SUCCESS_WITH_CHEER = new Set<string>([
  TOAST_MESSAGES.logged,
  TOAST_MESSAGES.saved,
  TOAST_MESSAGES.opened,
  TOAST_MESSAGES.undone,
  TOAST_MESSAGES.returned,
  TOAST_MESSAGES.deleted,
  "棚に並べました",
]);

export function toastShowsCheer(message: string): boolean {
  return SUCCESS_WITH_CHEER.has(message) || /^棚に \d+ 本並べました$/.test(message);
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
export type ToastTimerEvent =
  | "entry-complete"
  | "interaction-start"
  | "interaction-end"
  | "timeout"
  | "select";
export type ToastTimerEffect = "none" | "start-timer" | "pause-timer" | "dismiss" | "select";

export type ToastTimerTransition = {
  state: ToastTimerState;
  effect: ToastTimerEffect;
};

/**
 * アクション操作の開始後は click が完了するまで期限切れにしない。
 * 操作せず離れたら remaining を再開する。退場中の click も select できる。
 */
export function transitionToastTimer(
  state: ToastTimerState,
  event: ToastTimerEvent,
): ToastTimerTransition {
  if (state === "selected") {
    return { state, effect: "none" };
  }
  if (event === "select") {
    return { state: "selected", effect: "select" };
  }
  if (state === "expired") {
    return { state, effect: "none" };
  }
  if (event === "entry-complete") {
    return state === "entering"
      ? { state: "running", effect: "start-timer" }
      : { state, effect: "none" };
  }
  if (event === "interaction-start") {
    return { state: "interacting", effect: "pause-timer" };
  }
  if (event === "interaction-end") {
    return state === "interacting"
      ? { state: "running", effect: "start-timer" }
      : { state, effect: "none" };
  }
  if (event === "timeout") {
    return state === "interacting"
      ? { state, effect: "none" }
      : { state: "expired", effect: "dismiss" };
  }
  return { state, effect: "none" };
}
