import { describe, expect, it } from "vitest";
import { isAgeExemptApiRoute } from "./age.ts";
import { isPublicApiRoute } from "./auth.ts";

describe("isAgeExemptApiRoute", () => {
  it("公開ルートと me / 確認 API だけ通す", () => {
    expect(isAgeExemptApiRoute("GET", "/api/health")).toBe(true);
    expect(isAgeExemptApiRoute("POST", "/api/auth/sign-in/email")).toBe(true);
    expect(isAgeExemptApiRoute("GET", "/api/me")).toBe(true);
    expect(isAgeExemptApiRoute("HEAD", "/api/me")).toBe(true);
    expect(isAgeExemptApiRoute("POST", "/api/me/age-verification")).toBe(true);
  });

  it("機能 API は年齢確認が必要", () => {
    expect(isAgeExemptApiRoute("POST", "/api/me")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/me/age-verification")).toBe(false);
    expect(isAgeExemptApiRoute("POST", "/api/drink-logs")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/bottles")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/tasting-notes")).toBe(false);
    expect(isAgeExemptApiRoute("POST", "/api/photos")).toBe(false);
    expect(isAgeExemptApiRoute("GET", "/api/my-drinks")).toBe(false);
  });

  it("公開判定は auth のリストに委譲する", () => {
    expect(isPublicApiRoute("GET", "/api/health")).toBe(true);
    expect(isAgeExemptApiRoute("GET", "/api/health")).toBe(true);
  });
});
