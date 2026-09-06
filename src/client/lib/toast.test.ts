import { describe, expect, it, vi } from "vitest";
import {
  TOAST_MESSAGES,
  type ToastTimerEvent,
  type ToastTimerState,
  toastShowsCheer,
  transitionToastTimer,
} from "./toast.ts";

describe("toastShowsCheer", () => {
  it("保存成功の 4 文言だけ cheer を付ける", () => {
    expect(toastShowsCheer(TOAST_MESSAGES.logged)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saved)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.opened)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.deleted)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saveFailed)).toBe(false);
    expect(toastShowsCheer("読み込めませんでした")).toBe(false);
  });
});

describe("transitionToastTimer", () => {
  it("入場完了後に5秒タイマーを開始する", () => {
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

    expect(started).toEqual({ state: "interacting", effect: "none" });
    expect(timedOut).toEqual({ state: "interacting", effect: "none" });
  });

  it("操作開始なしで期限を迎えるとアンマウントする", () => {
    expect(transitionToastTimer("running", "timeout")).toEqual({
      state: "expired",
      effect: "dismiss",
    });
  });
});
