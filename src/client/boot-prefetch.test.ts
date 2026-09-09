import { describe, expect, it } from "vitest";
import { createApiClient } from "@/client/lib/api.ts";
import { EARLY_FETCH_TIMEOUT_MS } from "@/client/lib/boot.ts";
import {
  initialRouteChunkIds as appInitialRouteChunkIds,
  chunkIdForPath,
} from "@/client/lib/route-chunks.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { homeDataPaths, initialRouteChunkIds, SESSION_PATH } from "./boot-prefetch.ts";

describe("boot-prefetch の経路", () => {
  it("route-chunks と同じ画面 chunk を先読みする", () => {
    const paths = [
      "/login",
      "/signup",
      "/terms",
      "/privacy",
      "/",
      "/cellar",
      "/cellar/archive",
      "/notes/new",
      "/settings",
      "/logs",
      "/logs/new",
      "/logs/entries/abc/edit",
      "/logs/my-drinks",
      "/summary/week",
      "/unknown",
    ];
    for (const path of paths) {
      expect(initialRouteChunkIds(path)).toEqual([...appInitialRouteChunkIds(path)]);
    }
    expect(chunkIdForPath("/unknown")).toBeNull();
  });

  it("ホームの GET は RPC と同じ相対 URL になる", () => {
    const today = tokyoToday();
    const client = createApiClient();
    const day = client.api["drink-logs"].summary.$path({
      query: { period: "day", date: today },
    });
    const week = client.api["drink-logs"].summary.$path({
      query: { period: "week", date: today },
    });
    const drinks = client.api["my-drinks"].$path({ query: { limit: "30" } });
    expect(homeDataPaths(today)).toEqual([day, week, drinks]);
    expect(SESSION_PATH).toBe("/api/auth/get-session");
  });

  it("先読みタイムアウトは本バンドルと同じ 10 秒（静的 import はしない）", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "boot-prefetch.ts"),
      "utf8",
    );
    expect(EARLY_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(source).toContain("const EARLY_FETCH_TIMEOUT_MS = 10_000");
    expect(source).not.toMatch(/^import /m);
  });
});
