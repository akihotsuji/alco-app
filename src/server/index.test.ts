import { describe, expect, it } from "vitest";
import { app } from "@/server/index.ts";

describe("GET /api/health", () => {
  it("{ ok: true } を返す", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("セキュリティヘッダーが付く", async () => {
    const res = await app.request("/api/health");
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("未定義パス", () => {
  it('共通エラー形式 { error: "not_found" } の 404 を返す', async () => {
    const res = await app.request("/not-a-real-route");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
