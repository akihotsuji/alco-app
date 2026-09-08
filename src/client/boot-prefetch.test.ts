import { describe, expect, it } from "vitest";
import { createApiClient } from "@/client/lib/api.ts";
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
});
