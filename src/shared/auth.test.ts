import { describe, expect, it } from "vitest";
import { loginFormSchema, resolveSafeRedirect, signupFormSchema } from "./auth.ts";

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

describe("signupFormSchema", () => {
  it("パスワードは 8 文字以上", () => {
    expect(
      signupFormSchema.safeParse({
        name: "",
        email: "user@example.com",
        password: "1234567",
      }).success,
    ).toBe(false);
    expect(
      signupFormSchema.safeParse({
        name: "表示名",
        email: "user@example.com",
        password: "12345678",
      }).success,
    ).toBe(true);
  });
});
