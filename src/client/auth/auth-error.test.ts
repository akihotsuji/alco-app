import { describe, expect, it } from "vitest";
import { authClientErrorMessage } from "./auth-error.ts";

describe("authClientErrorMessage", () => {
  it("429 は共通の待機文言にする", () => {
    expect(authClientErrorMessage(429, "メールまたはパスワードが正しくありません")).toBe(
      "しばらく待ってから試してください",
    );
  });

  it("それ以外は呼び出し側の汎用文を返す", () => {
    expect(authClientErrorMessage(401, "メールまたはパスワードが正しくありません")).toBe(
      "メールまたはパスワードが正しくありません",
    );
    expect(
      authClientErrorMessage(undefined, "登録できませんでした。入力内容を確認してください"),
    ).toBe("登録できませんでした。入力内容を確認してください");
  });
});
