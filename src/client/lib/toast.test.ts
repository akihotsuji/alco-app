import { describe, expect, it } from "vitest";
import { TOAST_MESSAGES, toastShowsCheer } from "./toast.ts";

describe("toastShowsCheer", () => {
  it("保存成功の 4 文言だけ cheer を付ける", () => {
    expect(toastShowsCheer(TOAST_MESSAGES.logged)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saved)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.consumed)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.deleted)).toBe(true);
    expect(toastShowsCheer(TOAST_MESSAGES.saveFailed)).toBe(false);
    expect(toastShowsCheer("読み込めませんでした")).toBe(false);
  });
});
