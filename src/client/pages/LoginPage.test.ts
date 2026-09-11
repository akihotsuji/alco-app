import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GOOGLE_SIGN_IN_VISIBLE } from "@/shared/oauth.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("認証画面 8-03 / 8-04 / 8-05", () => {
  it("ログインにパスワード再設定の導線がある", () => {
    const login = readFileSync(join(here, "LoginPage.tsx"), "utf8");
    expect(login).toContain("パスワードを忘れた");
    expect(login).toContain("/forgot-password");
    expect(login).toContain("loginNoticeFromSearch");
  });

  it("ログインとサインアップの Google 導線は GOOGLE_SIGN_IN_VISIBLE で出し分け、いまは出す", () => {
    const login = readFileSync(join(here, "LoginPage.tsx"), "utf8");
    const signup = readFileSync(join(here, "SignupPage.tsx"), "utf8");
    expect(login).toContain("GoogleSignInButton");
    expect(login).toContain('mode="login"');
    expect(login).toContain("GOOGLE_SIGN_IN_VISIBLE ? (");
    expect(signup).toContain("GoogleSignInButton");
    expect(signup).toContain('mode="signup"');
    expect(signup).toContain("acceptedLegal={acceptedLegal}");
    expect(signup).toContain("GOOGLE_SIGN_IN_VISIBLE ? (");
    expect(GOOGLE_SIGN_IN_VISIBLE).toBe(true);
  });

  it("サインアップに招待コード欄が無い", () => {
    const signup = readFileSync(join(here, "SignupPage.tsx"), "utf8");
    expect(signup).not.toMatch(/invite|招待コード/i);
    expect(signup).toContain("result.error.message");
  });

  it("ログイン・サインアップ・再設定メールに Turnstile があり、新パスワードには無い", () => {
    const login = readFileSync(join(here, "LoginPage.tsx"), "utf8");
    const signup = readFileSync(join(here, "SignupPage.tsx"), "utf8");
    const reset = readFileSync(join(here, "PasswordResetPages.tsx"), "utf8");
    expect(login).toContain("TurnstileField");
    expect(login).toContain("turnstileRequestHeaders");
    expect(signup).toContain("TurnstileField");
    expect(reset).toContain("TurnstileField");
    expect(reset).toContain("ForgotPasswordPage");
    expect(reset.indexOf("TurnstileField")).toBeLessThan(reset.indexOf("ResetPasswordPage"));
    expect(reset.slice(reset.indexOf("export function ResetPasswordPage"))).not.toContain(
      "TurnstileField",
    );
  });
});
