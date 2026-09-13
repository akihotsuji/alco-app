import { describe, expect, it } from "vitest";
import { createApiClient } from "@/client/lib/api.ts";
import { EARLY_FETCH_TIMEOUT_MS } from "@/client/lib/boot.ts";
import {
  SHELF_COLUMNS_NARROW,
  SHELF_COLUMNS_WIDE,
  SHELF_TYPE_PAGE_LIMIT,
  SHELF_WIDE_MIN_PX,
  shelfPageLimit,
} from "@/client/lib/cellar-shelf.ts";
import {
  initialRouteChunkIds as appInitialRouteChunkIds,
  chunkIdForPath,
} from "@/client/lib/route-chunks.ts";
import { CELLAR_PREF_KEYS, DEFAULT_CELLAR_LIST_VIEW } from "@/shared/constants.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import {
  cellarDataPaths,
  GUEST_ONLY_PATHS,
  homeDataPaths,
  initialDataPaths,
  initialRouteChunkIds,
  ME_PATH,
  notesDataPaths,
  SESSION_PATH,
} from "./boot-prefetch.ts";

describe("boot-prefetch の経路", () => {
  it("route-chunks と同じ画面 chunk を先読みする", () => {
    const paths = [
      "/login",
      "/signup",
      "/age",
      "/forgot-password",
      "/reset-password",
      "/terms",
      "/privacy",
      "/",
      "/cellar",
      "/cellar/archive",
      "/notes/new",
      "/settings",
      "/settings/feedback",
      "/settings/account/delete",
      "/account-deleted",
      "/join",
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
    expect(ME_PATH).toBe(client.api.me.$path());
  });

  it("セラー一覧の GET は useBottles / useInfiniteBottles と同じ URL になる", () => {
    const client = createApiClient();
    const cellars = client.api.cellars.$path();
    const typeGrouped = client.api.bottles.$path({
      query: { view: "cellar", limit: String(SHELF_TYPE_PAGE_LIMIT), group: "type" },
    });
    const narrow = client.api.bottles.$path({
      query: { view: "cellar", limit: String(shelfPageLimit(SHELF_COLUMNS_NARROW)) },
    });
    const wide = client.api.bottles.$path({
      query: { view: "cellar", limit: String(shelfPageLimit(SHELF_COLUMNS_WIDE)) },
    });
    const cellarId = "11111111-1111-4111-8111-111111111111";
    const narrowWithCellar = client.api.bottles.$path({
      query: {
        view: "cellar",
        limit: String(shelfPageLimit(SHELF_COLUMNS_NARROW)),
        cellarId,
      },
    });
    const typeWithCellar = client.api.bottles.$path({
      query: {
        view: "cellar",
        limit: String(SHELF_TYPE_PAGE_LIMIT),
        group: "type",
        cellarId,
      },
    });
    expect(DEFAULT_CELLAR_LIST_VIEW).toBe("one");
    expect(CELLAR_PREF_KEYS.listView).toBe("cellar.listView");
    expect(CELLAR_PREF_KEYS.selectedId).toBe("cellar.selectedId");
    expect(SHELF_WIDE_MIN_PX).toBe(480);
    expect(SHELF_COLUMNS_NARROW).toBe(3);
    expect(SHELF_COLUMNS_WIDE).toBe(4);
    expect(cellars).toBe("/api/cellars");
    // 種類ごと（保存値・URL。URL が保存値より優先）
    expect(cellarDataPaths({ search: "", storedView: "type", viewportWidth: 390 })).toEqual([
      cellars,
      typeGrouped,
    ]);
    expect(
      cellarDataPaths({ search: "?view=type", storedView: "one", viewportWidth: 390 }),
    ).toEqual([cellars, typeGrouped]);
    // 1 本ずつ（既定。列数は幅で変わる）
    expect(cellarDataPaths({ search: "", storedView: null, viewportWidth: 390 })).toEqual([
      cellars,
      narrow,
    ]);
    expect(cellarDataPaths({ search: "", storedView: "bogus", viewportWidth: 390 })).toEqual([
      cellars,
      narrow,
    ]);
    expect(cellarDataPaths({ search: "?view=one", storedView: null, viewportWidth: 480 })).toEqual([
      cellars,
      wide,
    ]);
    expect(
      cellarDataPaths({
        search: "",
        storedView: null,
        viewportWidth: 390,
        storedCellarId: cellarId,
      }),
    ).toEqual([cellars, narrowWithCellar]);
    expect(
      cellarDataPaths({
        search: "?view=type",
        storedView: "one",
        viewportWidth: 390,
        storedCellarId: cellarId,
      }),
    ).toEqual([cellars, typeWithCellar]);
    expect(
      cellarDataPaths({
        search: "",
        storedView: null,
        viewportWidth: 390,
        storedCellarId: "not-a-uuid",
      }),
    ).toEqual([cellars, narrow]);
    // 絞り込み中はボトルを先読みしない（cellars は取る）
    expect(cellarDataPaths({ search: "?q=abc", storedView: null, viewportWidth: 390 })).toEqual([
      cellars,
    ]);
    expect(
      cellarDataPaths({ search: "?view=one&drinkType=wine", storedView: null, viewportWidth: 390 }),
    ).toEqual([cellars]);
    expect(SHELF_TYPE_PAGE_LIMIT).toBe(12);
  });

  it("ノート一覧の GET は useInfiniteTastingNotes の既定と同じ URL になる", () => {
    const client = createApiClient();
    const list = client.api["tasting-notes"].$path({ query: { limit: "50" } });
    expect(notesDataPaths("")).toEqual([list]);
    expect(notesDataPaths("?q=x")).toEqual([]);
    expect(notesDataPaths("?drinkType=wine")).toEqual([]);
    expect(notesDataPaths("?ratingX10Min=40")).toEqual([]);
    expect(notesDataPaths("?bottleId=abc")).toEqual([]);
  });

  it("パスごとの先読み対象。ゲスト画面では /api/me を投げない", () => {
    const today = tokyoToday();
    const cellar = { storedView: null, viewportWidth: 390 };
    expect(initialDataPaths("/", "", today, cellar)).toEqual([...homeDataPaths(today)]);
    expect(initialDataPaths("/cellar", "", today, cellar)).toEqual([
      ...cellarDataPaths({ search: "", ...cellar }),
    ]);
    expect(initialDataPaths("/notes", "", today, cellar)).toEqual([...notesDataPaths("")]);
    expect(initialDataPaths("/cellar/archive", "", today, cellar)).toEqual([]);
    expect(initialDataPaths("/settings", "", today, cellar)).toEqual([]);
    expect(GUEST_ONLY_PATHS).toEqual([
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/terms",
      "/privacy",
      "/account-deleted",
      "/join",
    ]);
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
