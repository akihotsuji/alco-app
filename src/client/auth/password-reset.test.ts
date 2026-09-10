import { describe, expect, it } from "vitest";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isInvalidResetLink,
  LOGIN_AFTER_RESET_MESSAGE,
  loginNoticeFromSearch,
  readResetToken,
  shouldStripResetQuery,
} from "./password-reset.ts";

describe("password-reset query", () => {
  it("token と INVALID_TOKEN を読む", () => {
    expect(readResetToken(new URLSearchParams("token=abc"))).toBe("abc");
    expect(readResetToken(new URLSearchParams(""))).toBeNull();
    expect(isInvalidResetLink(new URLSearchParams("error=INVALID_TOKEN"))).toBe(true);
    expect(isInvalidResetLink(new URLSearchParams("token=abc"))).toBe(false);
  });

  it("ログインの再設定完了文は reset=1 のときだけ", () => {
    expect(loginNoticeFromSearch(new URLSearchParams("reset=1"))).toBe(LOGIN_AFTER_RESET_MESSAGE);
    expect(loginNoticeFromSearch(new URLSearchParams(""))).toBeNull();
    expect(FORGOT_PASSWORD_SUCCESS_MESSAGE).toContain("再設定の案内");
  });

  it("token / error があるときだけ query を消す", () => {
    expect(shouldStripResetQuery(new URLSearchParams("token=abc"))).toBe(true);
    expect(shouldStripResetQuery(new URLSearchParams("error=INVALID_TOKEN"))).toBe(true);
    expect(shouldStripResetQuery(new URLSearchParams(""))).toBe(false);
  });
});
