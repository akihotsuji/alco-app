import { describe, expect, it } from "vitest";
import {
  CutoutError,
  cutoutFailedUserMessage,
  cutoutFailureFields,
  isCutoutLoadFailure,
  sanitizeErrorMessage,
} from "./cutout-result.ts";

describe("cutoutFailedUserMessage", () => {
  it("読み込み／初期化失敗と切り抜けなかったを区別する", () => {
    expect(cutoutFailedUserMessage("session_init")).toBe(
      "切り抜きの読み込みに失敗しました。長方形のまま保存します",
    );
    expect(cutoutFailedUserMessage("model_download")).toBe(
      "切り抜きの読み込みに失敗しました。長方形のまま保存します",
    );
    expect(cutoutFailedUserMessage("invalid_mask")).toBe(
      "うまく抜けませんでした。長方形のまま保存します",
    );
    expect(cutoutFailedUserMessage("empty_mask")).toBe(
      "うまく抜けませんでした。長方形のまま保存します",
    );
  });
});

describe("isCutoutLoadFailure", () => {
  it("session_init / model_download / unsupported だけを読み込み失敗とする", () => {
    expect(isCutoutLoadFailure("session_init")).toBe(true);
    expect(isCutoutLoadFailure("inference")).toBe(false);
  });
});

describe("cutoutFailureFields", () => {
  it("原因例外の名前とメッセージを安全に残す", () => {
    const error = new CutoutError("session_init", "ort load", {
      cause: new TypeError("Failed to fetch dynamically imported module: /assets/x.mjs"),
    });
    expect(cutoutFailureFields(error)).toEqual({
      reason: "session_init",
      detail: "ort load",
      causeName: "TypeError",
      causeMessage: "Failed to fetch dynamically imported module: /assets/x.mjs",
    });
  });
});

describe("sanitizeErrorMessage", () => {
  it("Cookie と Authorization を残さない", () => {
    expect(sanitizeErrorMessage("cookie=abc; ok")).toContain("cookie=redacted");
    expect(sanitizeErrorMessage("Authorization: Bearer secret-token")).toContain("redacted");
  });
});
