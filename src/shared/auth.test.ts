import { describe, expect, it } from "vitest";
import {
  AUTH_NAME_MAX_LENGTH,
  clipDisplayName,
  displayNameSchema,
  forgotPasswordFormSchema,
  isSignupsClosedFlag,
  loginFormSchema,
  RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
  resetPasswordFormSchema,
  resolveSafeRedirect,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  signupFormSchema,
} from "./auth.ts";

describe("isSignupsClosedFlag", () => {
  it("1 と true だけ真", () => {
    expect(isSignupsClosedFlag(undefined)).toBe(false);
    expect(isSignupsClosedFlag("0")).toBe(false);
    expect(isSignupsClosedFlag("1")).toBe(true);
    expect(isSignupsClosedFlag(" true ")).toBe(true);
  });
});

describe("session duration constants", () => {
  it("有効期間は 30 日、更新間隔は 1 日（秒）", () => {
    expect(SESSION_EXPIRES_IN_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(SESSION_UPDATE_AGE_SECONDS).toBe(60 * 60 * 24);
  });
});

describe("resolveSafeRedirect", () => {
  it("空や不正値は / にする", () => {
    expect(resolveSafeRedirect(undefined)).toBe("/");
    expect(resolveSafeRedirect(null)).toBe("/");
    expect(resolveSafeRedirect("")).toBe("/");
    expect(resolveSafeRedirect("https://evil.example")).toBe("/");
    expect(resolveSafeRedirect("//evil.example")).toBe("/");
    expect(resolveSafeRedirect("/\\evil.example")).toBe("/");
    expect(resolveSafeRedirect("cellar")).toBe("/");
  });

  it("相対パスだけ通し、認証画面は / に落とす", () => {
    expect(resolveSafeRedirect("/cellar")).toBe("/cellar");
    expect(resolveSafeRedirect("/logs?date=2026-09-05")).toBe("/logs?date=2026-09-05");
    expect(resolveSafeRedirect("/login")).toBe("/");
    expect(resolveSafeRedirect("/signup?x=1")).toBe("/");
    expect(resolveSafeRedirect("/age")).toBe("/");
    expect(resolveSafeRedirect("/age?redirect=%2Flogs")).toBe("/");
    expect(resolveSafeRedirect("/forgot-password")).toBe("/");
    expect(resolveSafeRedirect("/reset-password")).toBe("/");
  });
});

describe("loginFormSchema", () => {
  it("前後空白を除いたメールを受け付ける", () => {
    const parsed = loginFormSchema.parse({
      email: " user@example.com ",
      password: "x",
    });
    expect(parsed.email).toBe("user@example.com");
  });

  it("空パスワードは拒否する", () => {
    const result = loginFormSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("displayNameSchema", () => {
  it("前後空白を除き、空と 40 文字まで受け付ける", () => {
    expect(displayNameSchema.parse("  オーナー  ")).toBe("オーナー");
    expect(displayNameSchema.parse("")).toBe("");
    expect(displayNameSchema.parse("   ")).toBe("");
    expect(displayNameSchema.parse("あ".repeat(AUTH_NAME_MAX_LENGTH))).toBe(
      "あ".repeat(AUTH_NAME_MAX_LENGTH),
    );
  });

  it("41 文字は拒否する", () => {
    expect(displayNameSchema.safeParse("あ".repeat(AUTH_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("clipDisplayName は 40 文字で切る", () => {
    expect(clipDisplayName("  名前  ")).toBe("名前");
    expect(clipDisplayName(undefined)).toBe("");
    expect(clipDisplayName("あ".repeat(AUTH_NAME_MAX_LENGTH + 5))).toBe(
      "あ".repeat(AUTH_NAME_MAX_LENGTH),
    );
  });
});

describe("signupFormSchema", () => {
  it("パスワードは 8 文字以上", () => {
    expect(
      signupFormSchema.safeParse({
        name: "",
        email: "user@example.com",
        password: "1234567",
        acceptedLegal: true,
      }).success,
    ).toBe(false);
    expect(
      signupFormSchema.safeParse({
        name: "表示名",
        email: "user@example.com",
        password: "12345678",
        acceptedLegal: true,
      }).success,
    ).toBe(true);
    expect(
      signupFormSchema.safeParse({
        name: "表示名",
        email: "user@example.com",
        password: "12345678",
        acceptedLegal: false,
      }).success,
    ).toBe(false);
  });
});

describe("password reset schemas", () => {
  it("トークン有効期限は 1 時間", () => {
    expect(RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS).toBe(3600);
  });

  it("再設定要求は trim したメールだけ受け付ける", () => {
    expect(forgotPasswordFormSchema.parse({ email: " user@example.com " }).email).toBe(
      "user@example.com",
    );
    expect(forgotPasswordFormSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("新しいパスワードは確認欄と一致し、8 文字以上", () => {
    expect(
      resetPasswordFormSchema.safeParse({
        password: "1234567",
        confirmPassword: "1234567",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordFormSchema.safeParse({
        password: "12345678",
        confirmPassword: "12345679",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordFormSchema.parse({
        password: "12345678",
        confirmPassword: "12345678",
      }),
    ).toEqual({
      password: "12345678",
      confirmPassword: "12345678",
    });
  });
});
