import { afterEach, describe, expect, it, vi } from "vitest";
import { bottlesInfiniteQueryOptions, bottlesQueryOptions } from "@/client/hooks/use-bottles.ts";
import { drinkLogSummaryQueryOptions } from "@/client/hooks/use-drink-log-summary.ts";
import { myDrinksQueryOptions } from "@/client/hooks/use-my-drinks.ts";
import { tastingNotesInfiniteQueryOptions } from "@/client/hooks/use-tasting-notes.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import {
  prefetchTabData,
  scheduleIdle,
  TAB_PREFETCH_DELAY_MS,
  tabPrefetchEntries,
} from "./use-tab-data-prefetch.ts";

const TODAY = "2026-09-10";

describe("tabPrefetchEntries", () => {
  it("ホーム（日・週サマリー・マイドリンク）、セラー、ノートの初期一覧を対象にする", () => {
    const entries = tabPrefetchEntries({ cellarView: "one", viewportWidth: 390, today: TODAY });
    expect(entries.map((e) => e.queryKey)).toEqual([
      drinkLogSummaryQueryOptions("day", TODAY).queryKey,
      drinkLogSummaryQueryOptions("week", TODAY).queryKey,
      myDrinksQueryOptions().queryKey,
      // 1 本ずつ表示は 3 列 × 2 行分（CellarList と同じ limit）
      bottlesInfiniteQueryOptions({ view: "cellar", limit: 6 }).queryKey,
      tastingNotesInfiniteQueryOptions({}).queryKey,
    ]);
    expect(entries.map((e) => e.kind)).toEqual(["query", "query", "query", "infinite", "infinite"]);
  });

  it("広い画面では 4 列 × 2 行分を先読みする", () => {
    const entries = tabPrefetchEntries({ cellarView: "one", viewportWidth: 480, today: TODAY });
    expect(entries[3]?.queryKey).toEqual(
      bottlesInfiniteQueryOptions({ view: "cellar", limit: 8 }).queryKey,
    );
  });

  it("種類ごと表示のときは meta 用の limit=1 の単発 query を先読みする", () => {
    const entries = tabPrefetchEntries({ cellarView: "type", viewportWidth: 390, today: TODAY });
    expect(entries[3]).toMatchObject({
      kind: "query",
      queryKey: bottlesQueryOptions({ view: "cellar", limit: 1 }).queryKey,
    });
  });

  it("キーは各画面の hook が使うものと一致する（キャッシュが当たる）", () => {
    const entries = tabPrefetchEntries({ cellarView: "one", viewportWidth: 390, today: TODAY });
    expect(entries[0]?.queryKey).toEqual(queryKeys.drinkLogSummary("day", TODAY));
    expect(entries[2]?.queryKey).toEqual(queryKeys.myDrinks);
    expect(entries[3]?.queryKey).toEqual(
      queryKeys.bottlesList({ view: "cellar", q: undefined, drinkType: undefined, limit: 6 }),
    );
    expect(entries[4]?.queryKey).toEqual(
      queryKeys.tastingNotesList({
        bottleId: undefined,
        q: undefined,
        drinkType: undefined,
        ratingX10Min: undefined,
      }),
    );
  });
});

describe("prefetchTabData", () => {
  it("キャッシュが無い query だけ種類に応じて prefetch する", () => {
    const queryClient = createQueryClient();
    const prefetchQuery = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined);
    const prefetchInfiniteQuery = vi
      .spyOn(queryClient, "prefetchInfiniteQuery")
      .mockResolvedValue(undefined);
    const entries = tabPrefetchEntries({ cellarView: "one", viewportWidth: 390, today: TODAY });

    prefetchTabData(queryClient, entries);

    expect(prefetchQuery).toHaveBeenCalledTimes(3);
    expect(prefetchInfiniteQuery).toHaveBeenCalledTimes(2);
  });

  it("すでにキャッシュ（取得中を含む）がある query は触らない", () => {
    const queryClient = createQueryClient();
    const prefetchQuery = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined);
    const prefetchInfiniteQuery = vi
      .spyOn(queryClient, "prefetchInfiniteQuery")
      .mockResolvedValue(undefined);
    queryClient.setQueryData(myDrinksQueryOptions().queryKey, { items: [], nextCursor: null });
    queryClient.setQueryData(tastingNotesInfiniteQueryOptions({}).queryKey, {
      pages: [],
      pageParams: [],
    });
    const entries = tabPrefetchEntries({ cellarView: "one", viewportWidth: 390, today: TODAY });

    prefetchTabData(queryClient, entries);

    expect(prefetchQuery).toHaveBeenCalledTimes(2);
    expect(prefetchInfiniteQuery).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleIdle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("猶予のあとに実行し、キャンセルすれば実行しない", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const run = vi.fn();
    scheduleIdle(run, TAB_PREFETCH_DELAY_MS);
    vi.advanceTimersByTime(TAB_PREFETCH_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    const cancel = scheduleIdle(cancelled, TAB_PREFETCH_DELAY_MS);
    cancel();
    vi.advanceTimersByTime(TAB_PREFETCH_DELAY_MS * 2);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("requestIdleCallback があればそれを使い、キャンセルで取り消す", () => {
    vi.useFakeTimers();
    const requestIdle = vi.fn(() => 7);
    const cancelIdle = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdle);
    vi.stubGlobal("cancelIdleCallback", cancelIdle);
    const run = vi.fn();
    const cancel = scheduleIdle(run, TAB_PREFETCH_DELAY_MS);
    vi.advanceTimersByTime(TAB_PREFETCH_DELAY_MS);
    expect(requestIdle).toHaveBeenCalledWith(run, { timeout: TAB_PREFETCH_DELAY_MS * 2 });
    cancel();
    expect(cancelIdle).toHaveBeenCalledWith(7);
  });
});
