import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { BottleItem } from "@/shared/bottles.ts";

/**
 * 詳細の仮表示（performance.md 4b）。メモリ上の一覧キャッシュから同じ ID の 1 件を探す。
 * 読むだけで、一覧にも詳細の query にも書き込まない（楽観的更新ではない）。
 */

type ListPage = {
  items: readonly BottleItem[];
  typeShelves?: readonly { items: readonly BottleItem[] }[] | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isListPage(value: unknown): value is ListPage {
  return isRecord(value) && Array.isArray(value.items);
}

/** 単発の一覧は 1 ページ、無限一覧は `pages` の全ページ。それ以外（詳細など）は空 */
function pagesOf(data: unknown): readonly ListPage[] {
  if (isListPage(data)) {
    return [data];
  }
  if (isRecord(data) && Array.isArray(data.pages)) {
    return data.pages.filter(isListPage);
  }
  return [];
}

function findInPage(page: ListPage, id: string): BottleItem | undefined {
  const direct = page.items.find((item) => item.id === id);
  if (direct) {
    return direct;
  }
  for (const shelf of page.typeShelves ?? []) {
    const hit = shelf.items.find((item) => item.id === id);
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

/**
 * 取得に成功していて、無効化されていない一覧だけを見る。更新操作のあと再取得前の一覧は
 * 状態（未開栓 / 味わい中）が古いので使わない。複数の一覧に居れば取得時刻が新しいものを返す。
 */
export function findBottleInListCache(
  queryClient: QueryClient,
  id: string,
): BottleItem | undefined {
  let best: { item: BottleItem; updatedAt: number } | undefined;
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.bottles })) {
    // 一覧のキーは ["bottles", {...}]。詳細は ["bottles", id]
    if (!isRecord(query.queryKey[1])) {
      continue;
    }
    const { status, isInvalidated, dataUpdatedAt, data } = query.state;
    if (status !== "success" || isInvalidated) {
      continue;
    }
    if (best && best.updatedAt >= dataUpdatedAt) {
      continue;
    }
    for (const page of pagesOf(data)) {
      const item = findInPage(page, id);
      if (item) {
        best = { item, updatedAt: dataUpdatedAt };
        break;
      }
    }
  }
  return best?.item;
}
