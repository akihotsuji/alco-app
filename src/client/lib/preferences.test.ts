import { afterEach, describe, expect, it } from "vitest";
import { PHOTO_PREF_KEYS } from "@/shared/constants.ts";
import {
  getCellarRecognizePref,
  getColorCorrectionPref,
  getComposeMascotPref,
  getCutoutPref,
  setCellarRecognizePref,
  setColorCorrectionPref,
  setComposeMascotPref,
  setCutoutPref,
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

  it("読むときは 1 も true とみなす", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    memory.set(PHOTO_PREF_KEYS.mascot, "1");
    expect(getComposeMascotPref()).toBe(true);
  });
});
