import { describe, expect, it } from "vitest";
import {
  AUTH_NAME_MAX_LENGTH,
  displayNameSchema,
  loginFormSchema,
  resolveSafeRedirect,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  signupFormSchema,
} from "./auth.ts";

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
