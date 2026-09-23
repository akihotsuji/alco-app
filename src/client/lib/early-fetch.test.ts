import { describe, expect, it, vi } from "vitest";
import { earlyFetchKey, takeEarlyFetch } from "./early-fetch.ts";
import { settleEarlyFetch } from "./fetch-timeout.ts";

describe("earlyFetchKey", () => {
  it("相対・絶対・Request を pathname + search に揃える", () => {
    expect(earlyFetchKey("/api/auth/get-session")).toBe("/api/auth/get-session");
    expect(earlyFetchKey("https://example.test/api/auth/get-session")).toBe(
      "/api/auth/get-session",
    );
    expect(earlyFetchKey(new URL("https://example.test/api/my-drinks?limit=30"))).toBe(
      "/api/my-drinks?limit=30",
    );
    expect(earlyFetchKey(new Request("https://example.test/api/health"))).toBe("/api/health");
  });
});

describe("takeEarlyFetch", () => {
  it("GET の先読みを 1 回だけ渡し、本文は clone する", async () => {
    const taken: string[] = [];
    const store = {
      put() {
        throw new Error("put は take 側では呼ばない");
      },
      take(key: string) {
        taken.push(key);
        return Promise.resolve(new Response("early", { status: 200 }));
      },
    };

    const first = takeEarlyFetch("/api/auth/get-session", undefined, store);
    const skipped = takeEarlyFetch("/api/auth/get-session", { method: "POST" }, store);
    expect(skipped).toBeUndefined();
    expect(taken).toEqual(["/api/auth/get-session"]);
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("first");
    }
    const response = await first;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("early");
  });

  it("起動時の 401 は渡さず、ログイン後の live fetch に切り替えさせる", async () => {
    const store = {
      put() {},
      take: () => Promise.resolve(new Response("{}", { status: 401 })),
    };
    const early = takeEarlyFetch("/api/me", undefined, store);
    expect(early).toBeDefined();
    if (!early) {
      throw new Error("early");
    }
    const live = vi.fn(async () => new Response('{"id":"u1"}', { status: 200 }));
    const response = await settleEarlyFetch(early, live, 1_000);
    expect(live).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("401 以外のエラー応答（403 など）はそのまま渡す", async () => {
    const store = {
      put() {},
      take: () => Promise.resolve(new Response("{}", { status: 403 })),
    };
    const response = await takeEarlyFetch("/api/me", undefined, store);
    expect(response?.status).toBe(403);
  });
});
