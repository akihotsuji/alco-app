import { afterEach, describe, expect, it } from "vitest";
import { GUIDE_PREF_KEY } from "../../shared/constants";
import {
  hasExistingUserData,
  readGuidePref,
  resolveInitialGuide,
  writeGuidePref,
} from "./first-run-guide";

const memory = new Map<string, string>();
const localStorageStub = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
};

afterEach(() => {
  memory.clear();
});

describe("readGuidePref / writeGuidePref", () => {
  it("ユーザー単位で完了を記憶する", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    writeGuidePref("u1", "completed");
    expect(readGuidePref("u1")).toBe("completed");
    expect(readGuidePref("u2")).toBe("unset");
  });

  it("壊れた値は unset にする", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    localStorageStub.setItem(GUIDE_PREF_KEY, JSON.stringify({ userId: "u1", status: "broken" }));
    expect(readGuidePref("u1")).toBe("unset");
  });
});

describe("hasExistingUserData", () => {
  it("ホーム集計または一覧があれば既存とみなす", () => {
    expect(
      hasExistingUserData({
        todayLogCount: 0,
        weekLogCount: 0,
        myDrinkCount: 0,
        bottleCount: 1,
        noteCount: 0,
      }),
    ).toBe(true);
    expect(
      hasExistingUserData({
        todayLogCount: 0,
        weekLogCount: 0,
        myDrinkCount: 0,
        bottleCount: 0,
        noteCount: 0,
      }),
    ).toBe(false);
  });
});

describe("resolveInitialGuide", () => {
  it("既存ユーザーには強制開始しない", () => {
    expect(
      resolveInitialGuide({
        stored: "unset",
        hasExistingData: true,
        replayRequested: false,
      }),
    ).toEqual({ status: "existing", step: "off" });
  });

  it("未使用ユーザーは招待から始める", () => {
    expect(
      resolveInitialGuide({
        stored: "unset",
        hasExistingData: false,
        replayRequested: false,
      }),
    ).toEqual({ status: "unset", step: "invite" });
  });

  it("再実行は招待を省略してホーム案内から始める", () => {
    expect(
      resolveInitialGuide({
        stored: "completed",
        hasExistingData: true,
        replayRequested: true,
      }),
    ).toEqual({ status: "completed", step: "home-record" });
  });
});
