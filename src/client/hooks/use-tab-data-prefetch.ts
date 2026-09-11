import { type QueryClient, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { bottlesInfiniteQueryOptions, bottlesQueryOptions } from "@/client/hooks/use-bottles.ts";
import { drinkLogSummaryQueryOptions } from "@/client/hooks/use-drink-log-summary.ts";
import { myDrinksQueryOptions } from "@/client/hooks/use-my-drinks.ts";
import { tastingNotesInfiniteQueryOptions } from "@/client/hooks/use-tasting-notes.ts";
import { shelfColumns, shelfPageLimit } from "@/client/lib/cellar-shelf.ts";
import { getCellarListViewPref } from "@/client/lib/preferences.ts";
import type { CellarListView } from "@/shared/constants.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";

/**
 * 下部タブが最初に開いたときに描く一覧を、アプリ本体の描画が落ち着いてから先読みする。
 * 各タブの hook と同じ query options（キー・queryFn）を使うので、タブを開いた瞬間に
 * キャッシュが当たり、スケルトンを経ずに一覧が出る（`spec/features/performance.md`）。
 *
 * - フィルタ付き（検索・種類・評価）の一覧は先読みしない。初期表示で必ず使うものだけ
 * - すでにキャッシュがある query は触らない（画面が取得中のものと二重に走らせない）
 */
export type TabPrefetchEntry = {
  kind: "query" | "infinite";
  queryKey: QueryKey;
  prefetch: (queryClient: QueryClient) => Promise<void>;
};

type QueryOptionsLike = { queryKey: QueryKey };

function single<T extends QueryOptionsLike>(
  options: T,
  prefetch: (queryClient: QueryClient) => Promise<void>,
): TabPrefetchEntry {
  return { kind: "query", queryKey: options.queryKey, prefetch };
}

function infinite<T extends QueryOptionsLike>(
  options: T,
  prefetch: (queryClient: QueryClient) => Promise<void>,
): TabPrefetchEntry {
  return { kind: "infinite", queryKey: options.queryKey, prefetch };
}

export type TabPrefetchInput = {
  cellarView: CellarListView;
  viewportWidth: number;
  today: string;
};

export function tabPrefetchEntries(input: TabPrefetchInput): TabPrefetchEntry[] {
  const day = drinkLogSummaryQueryOptions("day", input.today);
  const week = drinkLogSummaryQueryOptions("week", input.today);
  const myDrinks = myDrinksQueryOptions();
  const notes = tastingNotesInfiniteQueryOptions({});
  const cellar = (() => {
    if (input.cellarView === "type") {
      const meta = bottlesQueryOptions({ view: "cellar", limit: 1 });
      return single(meta, (qc) => qc.prefetchQuery(meta));
    }
    const shelf = bottlesInfiniteQueryOptions({
      view: "cellar",
      limit: shelfPageLimit(shelfColumns(input.viewportWidth)),
    });
    return infinite(shelf, (qc) => qc.prefetchInfiniteQuery(shelf));
  })();
  return [
    single(day, (qc) => qc.prefetchQuery(day)),
    single(week, (qc) => qc.prefetchQuery(week)),
    single(myDrinks, (qc) => qc.prefetchQuery(myDrinks)),
    cellar,
    infinite(notes, (qc) => qc.prefetchInfiniteQuery(notes)),
  ];
}

export function prefetchTabData(queryClient: QueryClient, entries: TabPrefetchEntry[]): void {
  for (const entry of entries) {
    if (queryClient.getQueryState(entry.queryKey) !== undefined) {
      continue;
    }
    void entry.prefetch(queryClient);
  }
}

/** 先読みを始めるまでの猶予。現在地の画面の取得・描画を優先させる */
export const TAB_PREFETCH_DELAY_MS = 300;

type CancelIdle = () => void;

/** requestIdleCallback があれば使い、無ければ短い setTimeout で代用する */
export function scheduleIdle(run: () => void, delayMs: number): CancelIdle {
  let idleHandle: number | undefined;
  const timer = setTimeout(() => {
    if (typeof requestIdleCallback === "function") {
      idleHandle = requestIdleCallback(run, { timeout: delayMs * 2 });
      return;
    }
    run();
  }, delayMs);
  return () => {
    clearTimeout(timer);
    if (idleHandle !== undefined) {
      cancelIdleCallback(idleHandle);
    }
  };
}

export function useTabDataPrefetch(): void {
  const queryClient = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/settings/account/delete") {
      return;
    }
    return scheduleIdle(() => {
      prefetchTabData(
        queryClient,
        tabPrefetchEntries({
          cellarView: getCellarListViewPref(),
          viewportWidth: window.innerWidth,
          today: tokyoToday(),
        }),
      );
    }, TAB_PREFETCH_DELAY_MS);
  }, [location.pathname, queryClient]);
}
