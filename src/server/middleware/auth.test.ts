import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../app-env.ts";
import { appendSetCookieHeaders, isPublicApiRoute, PUBLIC_API_ROUTES } from "./auth.ts";

describe("isPublicApiRoute", () => {
  it("公開リストは health と auth のみ（spec/api-design.md 2.3）", () => {
    expect(PUBLIC_API_ROUTES).toEqual([
      { method: "GET", path: "/api/health" },
      { method: "*", prefix: "/api/auth/" },
    ]);
  });

  it("GET / HEAD /api/health は公開", () => {
    expect(isPublicApiRoute("GET", "/api/health")).toBe(true);
    expect(isPublicApiRoute("head", "/api/health")).toBe(true);
  });

  it("health は GET 以外・前後にパスが付くものは非公開", () => {
    expect(isPublicApiRoute("POST", "/api/health")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/health/")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/healthz")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/health/../me")).toBe(false);
  });

  it("/api/auth/ 配下は全メソッド公開。/api/auth 自体や /api/authors は非公開", () => {
    expect(isPublicApiRoute("POST", "/api/auth/sign-in/email")).toBe(true);
    expect(isPublicApiRoute("GET", "/api/auth/get-session")).toBe(true);
    expect(isPublicApiRoute("GET", "/api/auth")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/authors")).toBe(false);
  });

  it("業務ルートは非公開", () => {
    expect(isPublicApiRoute("GET", "/api/me")).toBe(false);
    expect(isPublicApiRoute("POST", "/api/photos")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/photos/1/content")).toBe(false);
    expect(isPublicApiRoute("GET", "/api/drink-logs")).toBe(false);
    expect(isPublicApiRoute("GET", "/api")).toBe(false);
  });
});

describe("appendSetCookieHeaders", () => {
  it("複数の Set-Cookie を潰さず append する", async () => {
    const app = new Hono<AppEnv>().get("/cookies", (c) => {
      const headers = new Headers();
      headers.append("Set-Cookie", "first=1; Path=/; HttpOnly");
      headers.append("Set-Cookie", "second=2; Path=/; HttpOnly");
      appendSetCookieHeaders(c, headers);
      return c.json({ ok: true });
    });

    const res = await app.request("/cookies");
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([
      "first=1; Path=/; HttpOnly",
      "second=2; Path=/; HttpOnly",
    ]);
  });
});
