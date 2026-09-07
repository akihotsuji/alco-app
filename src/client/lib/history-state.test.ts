import { afterEach, describe, expect, it } from "vitest";
import {
  applyCellarToolbarParams,
  applyNoteToolbarParams,
  bottleConsumeState,
  bottlePlacedState,
  captureCellarVisit,
  consumeLeftEvent,
  consumeUndoRequested,
  currentCellarVisit,
  historyHasFlag,
  historyIdx,
  isCellarListPath,
  isPhotoHandoff,
  markCellarVisitToastShown,
  nextBottleSearchParams,
  PHOTO_HANDOFF_FLAG,
  photoHandoffState,
  placedBottleEvent,
  releaseCellarVisit,
  rememberShelfEvent,
  replaceSearchKeepState,
  takeRememberedIntoVisit,
  takeRememberedShelfEvent,
  withHistoryFlag,
} from "./history-state.ts";

describe("historyIdx", () => {
  it("数値の idx だけ返す", () => {
    expect(historyIdx({ idx: 3 })).toBe(3);
    expect(historyIdx({ idx: 0 })).toBe(0);
    expect(historyIdx({ idx: "1" })).toBeUndefined();
    expect(historyIdx(null)).toBeUndefined();
    expect(historyIdx("idx")).toBeUndefined();
  });
});

describe("historyHasFlag", () => {
  it("真の真偽値だけをフラグとみなす", () => {
    expect(historyHasFlag({ alcoPhotoEdit: true }, "alcoPhotoEdit")).toBe(true);
    expect(historyHasFlag({ alcoPhotoEdit: false }, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag({ alcoPhotoEdit: "true" }, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag({}, "alcoPhotoEdit")).toBe(false);
    expect(historyHasFlag(null, "alcoPhotoEdit")).toBe(false);
  });
});

describe("withHistoryFlag", () => {
  it("router の idx を 1 進めて引き継ぎ、フラグを立てる", () => {
    expect(withHistoryFlag({ idx: 2, usr: null, key: "k" }, "alcoPhotoEdit")).toEqual({
      idx: 3,
      usr: null,
      key: "k",
      alcoPhotoEdit: true,
    });
  });

  it("idx が無ければ付けず、state が無くてもフラグだけ立てる", () => {
    expect(withHistoryFlag(null, "alcoPhotoEdit")).toEqual({ alcoPhotoEdit: true });
    expect(withHistoryFlag({ usr: 1 }, "alcoPhotoEdit")).toEqual({ usr: 1, alcoPhotoEdit: true });
    expect(withHistoryFlag({ idx: "1" }, "alcoPhotoEdit")).toEqual({
      idx: "1",
      alcoPhotoEdit: true,
    });
  });
});

describe("photoHandoffState / isPhotoHandoff", () => {
  it("撮影 → 使う で開いた log-new だけ真", () => {
    expect(isPhotoHandoff(photoHandoffState())).toBe(true);
    expect(isPhotoHandoff({ [PHOTO_HANDOFF_FLAG]: "1" })).toBe(false);
    expect(isPhotoHandoff(null)).toBe(false);
    expect(isPhotoHandoff(undefined)).toBe(false);
  });
});

describe("bottle consume / placed state", () => {
  const left = {
    bottleId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-06T00:00:00.000Z",
  };

  it("開栓の left と undo フラグを読む。drinkType も残す", () => {
    const withType = { ...left, drinkType: "wine" as const };
    const state = bottleConsumeState(withType);
    expect(consumeLeftEvent(state)).toEqual(withType);
    expect(consumeLeftEvent(bottleConsumeState(left))).toEqual(left);
    expect(consumeUndoRequested(state)).toBe(true);
    expect(consumeLeftEvent({ left: { bottleId: left.bottleId } })).toBeNull();
    expect(consumeUndoRequested({ consumeUndo: "1" })).toBe(false);
  });

  it("復元の placed を読む", () => {
    expect(placedBottleEvent(bottlePlacedState(left))).toEqual(left);
    expect(placedBottleEvent({ placed: "x" })).toBeNull();
  });

  it("sessionStorage の棚演出は 1 回だけ取る", () => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return memory.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          memory.set(key, value);
        },
        removeItem(key: string) {
          memory.delete(key);
        },
      },
    });
    rememberShelfEvent({ kind: "placed", ...left });
    expect(takeRememberedShelfEvent()).toEqual({ kind: "placed", ...left });
    expect(takeRememberedShelfEvent()).toBeNull();
  });
});

describe("cellar visit hold / search params", () => {
  const left = {
    bottleId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-06T00:00:00.000Z",
  };

  afterEach(() => {
    releaseCellarVisit();
  });

  it("同じ開栓イベントはトースト表示後も保持する", () => {
    const first = captureCellarVisit({ kind: "left", ...left });
    markCellarVisitToastShown();
    const again = captureCellarVisit({ kind: "left", ...left });

    expect(again).toBe(first);
    expect(currentCellarVisit()?.toastShown).toBe(true);
    expect(currentCellarVisit()?.event).toEqual({ kind: "left", ...left });
  });

  it("sessionStorage の take は visit があると二重消費しない", () => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return memory.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          memory.set(key, value);
        },
        removeItem(key: string) {
          memory.delete(key);
        },
      },
    });
    rememberShelfEvent({ kind: "left", ...left });
    expect(takeRememberedIntoVisit()).toEqual({ kind: "left", ...left });
    expect(takeRememberedIntoVisit()).toEqual({ kind: "left", ...left });
    expect(takeRememberedShelfEvent()).toBeNull();
  });

  it("q が同じなら search を更新しない", () => {
    expect(nextBottleSearchParams(new URLSearchParams(), "")).toBeNull();
    expect(nextBottleSearchParams(new URLSearchParams("q=赤"), "赤")).toBeNull();
    expect(nextBottleSearchParams(new URLSearchParams("drinkType=wine"), "")).toBeNull();
  });

  it("q が変わったときだけ search を返し、他のキーを残す", () => {
    const next = nextBottleSearchParams(new URLSearchParams("drinkType=wine"), "赤");
    expect(next?.get("q")).toBe("赤");
    expect(next?.get("drinkType")).toBe("wine");
  });

  it("同じ種類の再選択は navigate しない", () => {
    expect(
      applyCellarToolbarParams(new URLSearchParams("drinkType=wine"), {
        type: "selectDrinkType",
        drinkType: "wine",
      }),
    ).toBeNull();
  });

  it("replace 時に location.state を保持する", () => {
    const state = bottleConsumeState(left);
    expect(replaceSearchKeepState(state)).toEqual({ replace: true, state });
    expect(replaceSearchKeepState(undefined)).toEqual({ replace: true, state: null });
  });

  it("セラー一覧パスだけ visit を残す判定になる", () => {
    expect(isCellarListPath("/cellar")).toBe(true);
    expect(isCellarListPath("/cellar/archive")).toBe(false);
    expect(isCellarListPath("/cellar/bf7b96a1-0c2a-4035-8dba-55188f4473cb")).toBe(false);
  });
});

describe("applyNoteToolbarParams", () => {
  it("フィルタ解除でも bottleId を残す", () => {
    const next = applyNoteToolbarParams(
      new URLSearchParams("bottleId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&q=赤&ratingX10Min=40"),
      { type: "clearFilters" },
    );
    expect(next?.get("bottleId")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(next?.get("q")).toBeNull();
    expect(next?.get("ratingX10Min")).toBeNull();
  });

  it("★4 以上はトグル。同じ状態なら null", () => {
    expect(
      applyNoteToolbarParams(new URLSearchParams(), { type: "toggleRatingMin" })?.get(
        "ratingX10Min",
      ),
    ).toBe("40");
    expect(
      applyNoteToolbarParams(new URLSearchParams("ratingX10Min=40"), { type: "toggleRatingMin" }),
    ).toEqual(new URLSearchParams());
  });

  it("検索と種類を URL に写す。空の q は外す", () => {
    expect(applyNoteToolbarParams(new URLSearchParams(), { type: "setQuery", q: "赤" })?.get("q")).toBe(
      "赤",
    );
    expect(
      applyNoteToolbarParams(new URLSearchParams("q=赤"), { type: "setQuery", q: "" }),
    ).toEqual(new URLSearchParams());
    expect(
      applyNoteToolbarParams(new URLSearchParams(), { type: "selectDrinkType", drinkType: "beer" })?.get(
        "drinkType",
      ),
    ).toBe("beer");
    expect(
      applyNoteToolbarParams(new URLSearchParams("drinkType=beer"), { type: "clearDrinkType" }),
    ).toEqual(new URLSearchParams());
  });
});
