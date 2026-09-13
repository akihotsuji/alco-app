import { describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "@/shared/constants.ts";
import { checkPublishedAppVersion, fetchPublishedAppVersion } from "./version-watch.ts";

describe("fetchPublishedAppVersion", () => {
  it("HTML の fallback は捨てる", async () => {
    const html = await fetchPublishedAppVersion(
      async () =>
        new Response("<!doctype html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    );
    expect(html).toBeNull();
  });

  it("JSON だけ通す", async () => {
    const json = await fetchPublishedAppVersion(
      async () =>
        new Response(JSON.stringify({ version: APP_VERSION, buildId: "29c3055" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    expect(json).toEqual({ version: APP_VERSION, buildId: "29c3055" });
  });
});

describe("checkPublishedAppVersion", () => {
  it("間隔内は fetch しない", async () => {
    const fetchManifest = vi.fn(async () => ({ version: APP_VERSION, buildId: "bbbbbbb" }));
    const notify = vi.fn();
    const skipped = await checkPublishedAppVersion({
      now: 10_000,
      lastAt: 1_000,
      intervalMs: 30_000,
      currentBuildId: "aaaaaaa",
      fetchManifest,
      notify,
    });
    expect(skipped).toEqual({ notified: false, lastAt: 1_000 });
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  it("配信中が違えば通知する", async () => {
    const notify = vi.fn();
    const result = await checkPublishedAppVersion({
      now: 1_000,
      lastAt: null,
      currentBuildId: "aaaaaaa",
      fetchManifest: async () => ({ version: APP_VERSION, buildId: "bbbbbbb" }),
      notify,
    });
    expect(result.notified).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
