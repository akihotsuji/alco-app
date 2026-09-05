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

export function getComposeMascotPref(): boolean {
  return readFlag(PHOTO_PREF_KEYS.mascot, true);
}

export function setComposeMascotPref(value: boolean): void {
  writeFlag(PHOTO_PREF_KEYS.mascot, value);
}

export function getColorCorrectionPref(): boolean {
  return readFlag(PHOTO_PREF_KEYS.filter, true);
}

export function setColorCorrectionPref(value: boolean): void {
  writeFlag(PHOTO_PREF_KEYS.filter, value);
}

export function getCutoutPref(): boolean {
  return readFlag(PHOTO_PREF_KEYS.cutout, true);
}

export function setCutoutPref(value: boolean): void {
  writeFlag(PHOTO_PREF_KEYS.cutout, value);
}

export function getCellarRecognizePref(): boolean {
  return readFlag(PHOTO_PREF_KEYS.recognize, true);
}

export function setCellarRecognizePref(value: boolean): void {
  writeFlag(PHOTO_PREF_KEYS.recognize, value);
}
