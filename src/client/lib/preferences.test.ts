import { afterEach, describe, expect, it } from "vitest";
import {
  CELLAR_PREF_KEYS,
  LOGS_PREF_KEYS,
  PHOTO_PREF_KEYS,
  UI_PREF_KEYS,
} from "@/shared/constants.ts";
import {
  getCellarListViewPref,
  getCellarRecognizePref,
  getComposeMascotPref,
  getCutoutPref,
  getHapticPref,
  getRecordLocationPref,
  getReduceMotionPref,
  parseReduceMotionPref,
  setCellarListViewPref,
  setCellarRecognizePref,
  setComposeMascotPref,
  setCutoutPref,
  setHapticPref,
  setRecordLocationPref,
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
    expect(getCutoutPref()).toBe(true);
    expect(getCellarRecognizePref()).toBe(true);

    setComposeMascotPref(false);
    setCutoutPref(false);
    setCellarRecognizePref(false);

    expect(memory.get(PHOTO_PREF_KEYS.mascot)).toBe("false");
    expect(memory.get(PHOTO_PREF_KEYS.cutout)).toBe("false");
    expect(memory.get(PHOTO_PREF_KEYS.recognize)).toBe("false");
    expect(getComposeMascotPref()).toBe(false);
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

  it("現在地を記録するは既定 ON で、キーは logs.recordLocation", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    expect(LOGS_PREF_KEYS.recordLocation).toBe("logs.recordLocation");
    expect(getRecordLocationPref()).toBe(true);
    setRecordLocationPref(false);
    expect(memory.get(LOGS_PREF_KEYS.recordLocation)).toBe("false");
    expect(getRecordLocationPref()).toBe(false);
    setRecordLocationPref(true);
    expect(memory.get(LOGS_PREF_KEYS.recordLocation)).toBe("true");
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
