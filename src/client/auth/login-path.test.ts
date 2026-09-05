import { describe, expect, it } from "vitest";
import { resolveSafeRedirect } from "@/shared/auth.ts";
import { loginPathFor } from "./login-path.ts";

describe("loginPathFor", () => {
  it("ルート `/` は redirect を付けない", () => {
    expect(loginPathFor("/")).toBe("/login");
    expect(loginPathFor("/", "")).toBe("/login");
  });

  it("それ以外はパスとクエリをエンコードして redirect に載せる", () => {
    expect(loginPathFor("/logs/2026-09-05")).toBe("/login?redirect=%2Flogs%2F2026-09-05");
    expect(loginPathFor("/logs/new", "?camera=1")).toBe(
      "/login?redirect=%2Flogs%2Fnew%3Fcamera%3D1",
    );
  });

  it("載せた redirect はログイン後にそのまま安全に戻せる", () => {
    const url = new URL(loginPathFor("/cellar", "?view=archive"), "http://localhost");
    expect(resolveSafeRedirect(url.searchParams.get("redirect"))).toBe("/cellar?view=archive");
  });
});
