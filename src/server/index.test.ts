import { afterEach, describe, expect, it, vi } from "vitest";
import { app, createApp, handleScheduled } from "@/server/index.ts";
import { resetErrorAlertCooldownForTests } from "@/server/services/error-alert.ts";
import { publicConfigSchema } from "@/shared/turnstile.ts";

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

describe("GET /api/config", () => {
  it("未認証でサイトキーだけ返し、秘密を含まない", async () => {
    const empty = await app.request("/api/config");
    expect(empty.status).toBe(200);
    expect(publicConfigSchema.parse(await empty.json())).toEqual({ turnstileSiteKey: null });

    const configured = createApp({ turnstileSiteKey: "1x00000000000000000000AA" });
    const res = await configured.request("/api/config");
    expect(res.status).toBe(200);
    const body = publicConfigSchema.parse(await res.json());
    expect(body).toEqual({ turnstileSiteKey: "1x00000000000000000000AA" });
    expect(JSON.stringify(body)).not.toMatch(/secret|TURNSTILE_SECRET/i);
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
