import { describe, expect, it, vi } from "vitest";
import {
  TOAST_ACTION_DURATION_MS,
  TOAST_DURATION_MS,
  TOAST_MESSAGES,
  type ToastTimerEvent,
  type ToastTimerState,
  remainingToastMs,
  toastShowsCheer,
  toastStayMs,
  transitionToastTimer,
} from "./toast.ts";

describe("toastShowsCheer", () => {
  it("保存成功と棚に並べた文言に cheer を付ける", () => {
    expect(toastShowsCheer(TOAST_MESSAGES.logged)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saved)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.opened)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.undone)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.returned)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.deleted)).toBe(true);
    expect(toastShowsCheer("棚に並べました")).toBe(true);
    expect(toastShowsCheer("棚に 3 本並べました")).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saveFailed)).toBe(false);
    expect(toastShowsCheer(TOAST_MESSAGES.updateAvailable)).toBe(false);
    expect(toastShowsCheer("読み込めませんでした")).toBe(false);
  });
});

describe("toastStayMs", () => {
  it("操作なしは短く、操作付きは操作時間を残す", () => {
    expect(TOAST_DURATION_MS).toBe(2_500);
    expect(TOAST_ACTION_DURATION_MS).toBe(6_000);
    expect(toastStayMs(false)).toBe(TOAST_DURATION_MS);
    expect(toastStayMs(true)).toBe(TOAST_ACTION_DURATION_MS);
  });
});

describe("remainingToastMs", () => {
  it("経過分を引き、0 未満にはしない", () => {
    expect(remainingToastMs(1_000, 2_500, 1_800)).toBe(1_700);
    expect(remainingToastMs(1_000, 2_500, 4_000)).toBe(0);
  });
});

describe("transitionToastTimer", () => {
  it("入場完了後に滞在タイマーを開始する", () => {
    expect(transitionToastTimer("entering", "entry-complete")).toEqual({
      state: "running",
      effect: "start-timer",
    });
  });

  it("入場中に操作を始めた場合は入場完了でタイマーを再開しない", () => {
    const started = transitionToastTimer("entering", "interaction-start");

    expect(transitionToastTimer(started.state, "entry-complete")).toEqual({
      state: "interacting",
      effect: "none",
    });
  });

  it("操作せず離れたらタイマーを再開する", () => {
    const started = transitionToastTimer("running", "interaction-start");
    expect(started).toEqual({ state: "interacting", effect: "pause-timer" });
    expect(transitionToastTimer(started.state, "interaction-end")).toEqual({
      state: "running",
      effect: "start-timer",
    });
  });

  it("入場中の action click でも onSelect する", () => {
    expect(transitionToastTimer("entering", "select")).toEqual({
      state: "selected",
      effect: "select",
    });
  });

  it("退場中の click でも取り消しを実行する", () => {
    expect(transitionToastTimer("expired", "select")).toEqual({
      state: "selected",
      effect: "select",
    });
  });

  it("通常の action click は onSelect を1回だけ実行する", () => {
    let state: ToastTimerState = "running";
    const onSelect = vi.fn();
    const dispatch = (event: ToastTimerEvent) => {
      const transition = transitionToastTimer(state, event);
      state = transition.state;
      if (transition.effect === "select") {
        onSelect();
      }
    };

    dispatch("select");
    dispatch("select");

    expect(state).toBe("selected");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("期限境界で pointerdown 済みなら timeout でアンマウントしない", () => {
    const started = transitionToastTimer("running", "interaction-start");
    const timedOut = transitionToastTimer(started.state, "timeout");

    expect(started).toEqual({ state: "interacting", effect: "pause-timer" });
    expect(timedOut).toEqual({ state: "interacting", effect: "none" });
  });

  it("操作開始なしで期限を迎えるとアンマウントする", () => {
    expect(transitionToastTimer("running", "timeout")).toEqual({
      state: "expired",
      effect: "dismiss",
    });
  });
});
