import { parseCellarListView } from "@/client/lib/cellar-shelf.ts";
import {
  CELLAR_PREF_KEYS,
  type CellarListView,
  DEFAULT_CELLAR_LIST_VIEW,
  LOGS_PREF_KEYS,
  PHOTO_PREF_KEYS,
  REDUCE_MOTION_PREFS,
  type ReduceMotionPref,
  THEME_PREFS,
  type ThemePref,
  UI_PREF_KEYS,
} from "@/shared/constants.ts";

/** 設定画面での変更を同一タブ内の購読者（useReducedMotion 等）へ伝える。storage イベントは別タブ用 */
export const PREF_CHANGE_EVENT = "alco:pref-change";

function notifyPrefChange(key: string): void {
  if (typeof window === "undefined" || typeof CustomEvent !== "function") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PREF_CHANGE_EVENT, { detail: { key } }));
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // プライベートモード等では保存できない。既定値のまま動かす
  }
  notifyPrefChange(key);
}

function flagPref(key: string, fallback: boolean) {
  return {
    get: () => readFlag(key, fallback),
    set: (value: boolean) => writeFlag(key, value),
  };
}

const composeMascot = flagPref(PHOTO_PREF_KEYS.mascot, true);
const colorCorrection = flagPref(PHOTO_PREF_KEYS.filter, true);
const cutout = flagPref(PHOTO_PREF_KEYS.cutout, true);
const cellarRecognize = flagPref(PHOTO_PREF_KEYS.recognize, true);

export const getComposeMascotPref = composeMascot.get;
export const setComposeMascotPref = composeMascot.set;
export const getColorCorrectionPref = colorCorrection.get;
export const setColorCorrectionPref = colorCorrection.set;
export const getCutoutPref = cutout.get;
export const setCutoutPref = cutout.set;
export const getCellarRecognizePref = cellarRecognize.get;
export const setCellarRecognizePref = cellarRecognize.set;

export function getCellarListViewPref(): CellarListView {
  try {
    return (
      parseCellarListView(localStorage.getItem(CELLAR_PREF_KEYS.listView)) ??
      DEFAULT_CELLAR_LIST_VIEW
    );
  } catch {
    return DEFAULT_CELLAR_LIST_VIEW;
  }
}

export function setCellarListViewPref(value: CellarListView): void {
  try {
    localStorage.setItem(CELLAR_PREF_KEYS.listView, value);
  } catch {
    // 保存できなくても URL の ?view= で動く
  }
  notifyPrefChange(CELLAR_PREF_KEYS.listView);
}

/** 触感フィードバック（06-settings S8）。既定 OFF */
const hapticPref = flagPref(UI_PREF_KEYS.haptic, false);
export const getHapticPref = hapticPref.get;
export const setHapticPref = hapticPref.set;

/** 現在地を記録する（06-settings S12）。既定 ON */
const recordLocationPref = flagPref(LOGS_PREF_KEYS.recordLocation, true);
export const getRecordLocationPref = recordLocationPref.get;
export const setRecordLocationPref = recordLocationPref.set;

export function parseReduceMotionPref(raw: string | null): ReduceMotionPref {
  for (const value of REDUCE_MOTION_PREFS) {
    if (raw === value) {
      return value;
    }
  }
  return "system";
}

/** 動きを減らす（06-settings S9）。`system` = OS 設定に従う（既定）/ `always` = 常に減らす */
export function getReduceMotionPref(): ReduceMotionPref {
  try {
    return parseReduceMotionPref(localStorage.getItem(UI_PREF_KEYS.reduceMotion));
  } catch {
    return "system";
  }
}

export function setReduceMotionPref(value: ReduceMotionPref): void {
  try {
    localStorage.setItem(UI_PREF_KEYS.reduceMotion, value);
  } catch {
    // 保存できなくても既定値で動く
  }
  notifyPrefChange(UI_PREF_KEYS.reduceMotion);
}

export function parseThemePref(raw: string | null): ThemePref {
  for (const value of THEME_PREFS) {
    if (raw === value) {
      return value;
    }
  }
  return "system";
}

/** 外観（06-settings S10）。`system` = 端末の外観設定に従う（既定）/ `light` / `dark` */
export function getThemePref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(UI_PREF_KEYS.theme));
  } catch {
    return "system";
  }
}

export function setThemePref(value: ThemePref): void {
  try {
    localStorage.setItem(UI_PREF_KEYS.theme, value);
  } catch {
    // 保存できなくても既定値（端末に従う）で動く
  }
  notifyPrefChange(UI_PREF_KEYS.theme);
}
