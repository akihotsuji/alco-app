import { PHOTO_PREF_KEYS } from "@/shared/constants.ts";

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
