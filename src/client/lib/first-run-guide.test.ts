import { afterEach, describe, expect, it } from "vitest";
import { GUIDE_PREF_KEY } from "../../shared/constants";
import {
  guideDoneCopy,
  guideSpotlight,
  guideSpotlightPath,
  guideStepProgress,
  hasExistingUserData,
  nextGuideStep,
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

  it("記録案内は 1/3、量は 2/3、保存は 3/3", () => {
    expect(guideStepProgress("home-record")).toEqual({ current: 1, total: 3 });
    expect(guideStepProgress("practice-volume")).toEqual({ current: 2, total: 3 });
    expect(guideStepProgress("practice-save")).toEqual({ current: 3, total: 3 });
    expect(guideStepProgress("invite")).toBeNull();
  });

  it("セラーとノートも 3 歩", () => {
    expect(guideStepProgress("cellar-add")).toEqual({ current: 1, total: 3 });
    expect(guideStepProgress("cellar-save")).toEqual({ current: 3, total: 3 });
    expect(guideStepProgress("notes-create")).toEqual({ current: 1, total: 3 });
    expect(guideStepProgress("notes-save")).toEqual({ current: 3, total: 3 });
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

describe("nextGuideStep / spotlight", () => {
  it("記録は量の次が保存、保存の次が完了", () => {
    expect(nextGuideStep("invite", "continue")).toBe("home-record");
    expect(nextGuideStep("home-record", "continue")).toBe("practice-volume");
    expect(nextGuideStep("practice-volume", "continue")).toBe("practice-save");
    expect(nextGuideStep("practice-save", "continue")).toBe("done");
    expect(nextGuideStep("home-record", "skip")).toBeNull();
  });

  it("保存までスポットライト対象がある", () => {
    expect(guideSpotlight("home-record")?.target).toContain("record");
    expect(guideSpotlight("practice-volume")?.target).toContain("volume");
    expect(guideSpotlight("practice-save")?.target).toContain("save");
    expect(guideSpotlight("cellar-save")?.target).toContain("save");
    expect(guideSpotlight("notes-save")?.target).toContain("save");
    expect(guideSpotlight("done")).toBeNull();
    expect(guideSpotlightPath("home-record")).toBe("/");
    expect(guideSpotlightPath("cellar-add")).toBe("/cellar");
    expect(guideSpotlightPath("notes-create")).toBe("/notes");
    expect(guideSpotlightPath("practice-volume")).toBeNull();
  });

  it("記録完了は設定の使い方へつなぐ", () => {
    expect(guideDoneCopy("done").detail).toContain("使い方を見る");
    expect(guideDoneCopy("cellar-done").title).toContain("セラー");
    expect(guideDoneCopy("notes-done").title).toContain("ノート");
  });
});
