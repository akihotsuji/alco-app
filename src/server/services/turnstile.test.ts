import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_SITEVERIFY_URL } from "@/shared/turnstile.ts";
import { createTurnstileVerifier, verifyTurnstileToken } from "./turnstile.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("verifyTurnstileToken", () => {
  it("空・長すぎるトークンは上流を呼ばず失敗する", async () => {
    const fetchImpl = vi.fn();
    expect(
      await verifyTurnstileToken({ secret: "s", token: "", fetchImpl }),
    ).toBe(false);
    expect(
      await verifyTurnstileToken({ secret: "s", token: "x".repeat(2049), fetchImpl }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("success: true だけ通し、トークンをログしない", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await verifyTurnstileToken({
        secret: "turnstile-secret",
        token: "tok-abc",
        remoteIp: "203.0.113.1",
        fetchImpl,
      }),
    ).toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    const body = String(init.body);
    expect(body).toContain("secret=turnstile-secret");
    expect(body).toContain("response=tok-abc");
    expect(body).toContain("remoteip=203.0.113.1");
    expect(JSON.stringify(log.mock.calls)).not.toContain("tok-abc");
    expect(JSON.stringify(error.mock.calls)).not.toContain("turnstile-secret");
    log.mockRestore();
    error.mockRestore();
  });

  it("success: false・非 JSON・HTTP 失敗・例外は失敗", async () => {
    expect(
      await verifyTurnstileToken({
        secret: "s",
        token: "t",
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ success: false })),
      }),
    ).toBe(false);
    expect(
      await verifyTurnstileToken({
        secret: "s",
        token: "t",
        fetchImpl: vi.fn().mockResolvedValue(new Response("nope", { status: 200 })),
      }),
    ).toBe(false);
    expect(
      await verifyTurnstileToken({
        secret: "s",
        token: "t",
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ success: true }, 502)),
      }),
    ).toBe(false);
    expect(
      await verifyTurnstileToken({
        secret: "s",
        token: "t",
        fetchImpl: vi.fn().mockRejectedValue(new Error("network")),
      }),
    ).toBe(false);
  });
});

describe("createTurnstileVerifier", () => {
  it("secret を閉じて VerifyTurnstile にする", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    const verify = createTurnstileVerifier("closed-secret", fetchImpl);
    expect(await verify({ token: "tok" })).toBe(true);
    const body = String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body);
    expect(body).toContain("closed-secret");
  });
});
