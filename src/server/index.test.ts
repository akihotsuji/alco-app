import { afterEach, describe, expect, it, vi } from "vitest";
import { app, handleScheduled } from "@/server/index.ts";
import { resetErrorAlertCooldownForTests } from "@/server/services/error-alert.ts";

function envWith(values: object): Env {
  return values as unknown as Env;
}

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

describe("handleScheduled", () => {
  afterEach(() => {
    resetErrorAlertCooldownForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("GC 失敗は scheduled_error を送り、例外は握りつぶさない", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handleScheduled(envWith({ ALERT_WEBHOOK_URL: "https://alert.example/hook" })),
    ).rejects.toThrow();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const posted = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as {
      kind: string;
      method: string;
      path: string;
      errorName: string;
      worker: string;
    };
    expect(posted.kind).toBe("scheduled_error");
    expect(posted.method).toBe("CRON");
    expect(posted.path).toBe("scheduled");
    expect(posted.worker).toBe("alco-app-dev");
    expect(posted.errorName).toMatch(/^[A-Za-z][A-Za-z0-9]{0,63}$/);
  });
});
