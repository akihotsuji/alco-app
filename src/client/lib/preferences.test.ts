import { afterEach, describe, expect, it } from "vitest";
import { CELLAR_PREF_KEYS, PHOTO_PREF_KEYS, UI_PREF_KEYS } from "@/shared/constants.ts";
import {
  getCellarListViewPref,
  getCellarRecognizePref,
  getColorCorrectionPref,
  getComposeMascotPref,
  getCutoutPref,
  getHapticPref,
  getReduceMotionPref,
  parseReduceMotionPref,
  setCellarListViewPref,
  setCellarRecognizePref,
  setColorCorrectionPref,
  setComposeMascotPref,
  setCutoutPref,
  setHapticPref,
  setReduceMotionPref,
} from "./preferences.ts";

const memory = new Map<string, string>();

const localStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
};

describe("PHOTO_PREF_KEYS", () => {
  it("設定と photo-edit が同じキーを読む", () => {
    expect(PHOTO_PREF_KEYS).toEqual({
      mascot: "photo.mascot",
      filter: "photo.filter",
      cutout: "photo.cutout",
      recognize: "cellar.recognize",
    });
  });
});

describe("flag preferences", () => {
  afterEach(() => {
    memory.clear();
  });

  it("未保存は既定値、書き込みは true/false 文字列", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });

    expect(getComposeMascotPref()).toBe(true);
    expect(getColorCorrectionPref()).toBe(true);
    expect(getCutoutPref()).toBe(true);
    expect(getCellarRecognizePref()).toBe(true);

    setComposeMascotPref(false);
    setColorCorrectionPref(false);
    setCutoutPref(false);
    setCellarRecognizePref(false);

    expect(memory.get(PHOTO_PREF_KEYS.mascot)).toBe("false");
    expect(memory.get(PHOTO_PREF_KEYS.filter)).toBe("false");
    expect(memory.get(PHOTO_PREF_KEYS.cutout)).toBe("false");
    expect(memory.get(PHOTO_PREF_KEYS.recognize)).toBe("false");
    expect(getComposeMascotPref()).toBe(false);
    expect(getColorCorrectionPref()).toBe(false);
    expect(getCutoutPref()).toBe(false);
    expect(getCellarRecognizePref()).toBe(false);
  });

  it("棚の表示切替は cellar.listView、既定 one", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    expect(CELLAR_PREF_KEYS.listView).toBe("cellar.listView");
    expect(getCellarListViewPref()).toBe("one");
    setCellarListViewPref("type");
    expect(memory.get(CELLAR_PREF_KEYS.listView)).toBe("type");
    expect(getCellarListViewPref()).toBe("type");
  });

  it("読むときは 1 も true とみなす", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    memory.set(PHOTO_PREF_KEYS.mascot, "1");
    expect(getComposeMascotPref()).toBe(true);
  });
});

describe("UI 操作設定", () => {
  afterEach(() => {
    memory.clear();
  });

  it("触感フィードバックは既定 OFF で、キーは ui.haptic", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    expect(UI_PREF_KEYS.haptic).toBe("ui.haptic");
    expect(getHapticPref()).toBe(false);
    setHapticPref(true);
    expect(memory.get(UI_PREF_KEYS.haptic)).toBe("true");
    expect(getHapticPref()).toBe(true);
    setHapticPref(false);
    expect(memory.get(UI_PREF_KEYS.haptic)).toBe("false");
  });

  it("動きを減らすは既定 system、always を保存できる", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    expect(UI_PREF_KEYS.reduceMotion).toBe("ui.reduce-motion");
    expect(getReduceMotionPref()).toBe("system");
    setReduceMotionPref("always");
    expect(memory.get(UI_PREF_KEYS.reduceMotion)).toBe("always");
    expect(getReduceMotionPref()).toBe("always");
    expect(parseReduceMotionPref("broken")).toBe("system");
  });
});
