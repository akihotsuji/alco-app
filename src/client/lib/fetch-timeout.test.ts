import { describe, expect, it, vi } from "vitest";
import { createTimedFetch, fetchWithTimeout, settleEarlyFetch } from "./fetch-timeout.ts";

describe("settleEarlyFetch", () => {
  it("先読み成功を使い、後から来る fallback では上書きしない", async () => {
    const early = Promise.resolve(new Response("early", { status: 200 }));
    const fallback = vi.fn(async () => new Response("late", { status: 200 }));
    const response = await settleEarlyFetch(early, fallback, 1_000);
    expect(await response.text()).toBe("early");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("先読み失敗なら fallback する", async () => {
    const early = Promise.reject(new Error("abort"));
    const response = await settleEarlyFetch(
      early,
      async () => new Response("live", { status: 200 }),
      1_000,
    );
    expect(await response.text()).toBe("live");
  });

  it("先読みが遅いときは fallback を採用し、遅い応答では上書きしない", async () => {
    let resolveEarly: (value: Response) => void = () => undefined;
    const early = new Promise<Response>((resolve) => {
      resolveEarly = resolve;
    });
    const response = await settleEarlyFetch(
      early,
      async () => new Response("fallback", { status: 200 }),
      20,
    );
    expect(await response.text()).toBe("fallback");
    resolveEarly(new Response("stale", { status: 200 }));
    await Promise.resolve();
  });
});

describe("fetchWithTimeout", () => {
  it("timeout の signal を付けて呼ぶ", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok", { status: 200 });
    });
    const response = await fetchWithTimeout("/api/auth/get-session", undefined, fetchImpl, 1_000);
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("createTimedFetch", () => {
  it("先読みが取れなければ live fetch する", async () => {
    const fetchImpl = vi.fn(async () => new Response("live", { status: 200 }));
    const timed = createTimedFetch({
      fetchImpl,
      takeEarly: () => undefined,
      timeoutMs: 1_000,
    });
    const response = await timed("/api/auth/get-session");
    expect(await response.text()).toBe("live");
  });
});
