import { getHapticPref } from "@/client/lib/preferences.ts";

/**
 * 触感フィードバック（motion-design 6.5）。`navigator.vibrate` はここからだけ呼ぶ。
 * 既定 OFF（設定「触感フィードバック」で ON）。未対応端末（iOS Safari）では何もしない。
 * `error` は持たない（失敗は文言で伝える）。
 */
export const HAPTIC_PATTERNS = {
  light: [10],
  success: [10, 40, 10],
} as const satisfies Record<string, readonly number[]>;

export type HapticKind = keyof typeof HAPTIC_PATTERNS;

/** 1 パターンの合計は 100ms を超えない */
export const HAPTIC_MAX_TOTAL_MS = 100;

type Vibrate = (pattern: number[]) => boolean;

export type HapticDeps = {
  isEnabled: () => boolean;
  getVibrate: () => Vibrate | undefined;
};

export function createHaptic(deps: HapticDeps) {
  return function haptic(kind: HapticKind): boolean {
    if (!deps.isEnabled()) {
      return false;
    }
    const vibrate = deps.getVibrate();
    if (!vibrate) {
      return false;
    }
    try {
      return vibrate([...HAPTIC_PATTERNS[kind]]);
    } catch {
      return false;
    }
  };
}

function browserVibrate(): Vibrate | undefined {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return undefined;
  }
  return (pattern) => navigator.vibrate(pattern);
}

/** 設定画面が「この端末では使えません」を出す判定 */
export function isHapticSupported(): boolean {
  return browserVibrate() !== undefined;
}

export const haptic = createHaptic({ isEnabled: getHapticPref, getVibrate: browserVibrate });
