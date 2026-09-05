import { describe, expect, it } from "vitest";
import { resolveSafeRedirect } from "@/shared/auth.ts";
import { loginPathFor } from "./auth-redirect.ts";

describe("loginPathFor", () => {
  it("パスとクエリを redirect に入れる", () => {
    expect(loginPathFor({ pathname: "/logs", search: "?date=2026-09-05" })).toBe(
      "/login?redirect=%2Flogs%3Fdate%3D2026-09-05",
    );
  });

  it("ルートは redirect=/ になる", () => {
    expect(loginPathFor({ pathname: "/", search: "" })).toBe("/login?redirect=%2F");
  });

  it("作った redirect はログイン後の安全な遷移先として通る", () => {
    const url = new URL(loginPathFor({ pathname: "/cellar", search: "?view=archive" }), "http://x");
    expect(resolveSafeRedirect(url.searchParams.get("redirect"))).toBe("/cellar?view=archive");
  });
});
