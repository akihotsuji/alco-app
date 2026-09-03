import { describe, expect, it } from "vitest";
import { app } from "@/server/index.ts";

describe("GET /api/health", () => {
  it("{ ok: true } を返す", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("未定義の /api", () => {
  it("内部情報なしの 404 を返す", async () => {
    const res = await app.request("/api/not-a-real-route");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false });
  });
});
