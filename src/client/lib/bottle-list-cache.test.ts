import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { findBottleInListCache } from "@/client/lib/bottle-list-cache.ts";
import { createQueryClient } from "@/client/lib/query-client.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { Bottle, BottleItem, BottlesResponse } from "@/shared/bottles.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function item(partial: Partial<BottleItem> & Pick<BottleItem, "id" | "name">): BottleItem {
  return {
    drinkType: "wine",
    producer: null,
    origin: null,
    variety: null,
    vintage: null,
    purchasedOn: null,
    priceJpy: null,
    shop: null,
    storedOn: null,
    storage: null,
    memo: null,
    status: "sealed",
    openedAt: null,
    openedOn: null,
    finishedAt: null,
    finishedOn: null,
    consumedAt: null,
    consumedOn: null,
    thumbPhotoId: null,
    thumbPhotoKind: null,
    cellarId: "33333333-3333-4333-8333-333333333333",
    version: 1,
    createdByName: null,
    updatedByName: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    ...partial,
  };
}

function page(partial: Partial<BottlesResponse>): BottlesResponse {
  return {
    items: [],
    nextCursor: null,
    totalCount: 0,
    countsByType: {
      wine: 0,
      sake: 0,
      beer: 0,
      shochu: 0,
      whisky: 0,
      cocktail: 0,
      other: 0,
    } as BottlesResponse["countsByType"],
    ...partial,
  };
}

const cellarKey = queryKeys.bottlesList({ view: "cellar", limit: 6 });
const openedKey = queryKeys.bottlesList({ view: "opened", limit: 30 });

describe("findBottleInListCache", () => {
  it("一覧が無ければ見つからない", () => {
    expect(findBottleInListCache(createQueryClient(), ID)).toBeUndefined();
  });

  it("単発の一覧（味わい中の列など）から同じ ID の 1 件を返す", () => {
    const queryClient = createQueryClient();
    const target = item({ id: ID, name: "山崎", status: "opened" });
    queryClient.setQueryData(
      openedKey,
      page({ items: [item({ id: OTHER_ID, name: "別" }), target] }),
    );
    expect(findBottleInListCache(queryClient, ID)).toBe(target);
    expect(findBottleInListCache(queryClient, "44444444-4444-4444-8444-444444444444")).toBe(
      undefined,
    );
  });

  it("無限一覧は 2 ページ目以降も探す", () => {
    const queryClient = createQueryClient();
    const target = item({ id: ID, name: "山崎" });
    queryClient.setQueryData<InfiniteData<BottlesResponse>>(cellarKey, {
      pages: [page({ items: [item({ id: OTHER_ID, name: "別" })] }), page({ items: [target] })],
      pageParams: [undefined, "c1"],
    });
    expect(findBottleInListCache(queryClient, ID)).toBe(target);
  });

  it("種類ごとの棚（typeShelves）も探す", () => {
    const queryClient = createQueryClient();
    const target = item({ id: ID, name: "山崎", drinkType: "whisky" });
    queryClient.setQueryData(
      queryKeys.bottlesList({ view: "cellar", group: "type", limit: 4 }),
      page({ typeShelves: [{ drinkType: "whisky", items: [target], nextCursor: null }] }),
    );
    expect(findBottleInListCache(queryClient, ID)).toBe(target);
  });

  it("複数の一覧に居れば取得時刻が新しいものを返す", () => {
    const queryClient = createQueryClient();
    const older = item({ id: ID, name: "山崎", status: "sealed", version: 1 });
    const newer = item({ id: ID, name: "山崎", status: "opened", version: 2 });
    queryClient.setQueryData(openedKey, page({ items: [newer] }), { updatedAt: 2_000 });
    queryClient.setQueryData(
      cellarKey,
      { pages: [page({ items: [older] })], pageParams: [null] },
      {
        updatedAt: 1_000,
      },
    );
    expect(findBottleInListCache(queryClient, ID)).toBe(newer);
  });

  it("無効化された一覧（更新操作のあと再取得前）は使わない", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(openedKey, page({ items: [item({ id: ID, name: "山崎" })] }));
    await queryClient.invalidateQueries({ queryKey: queryKeys.bottles, refetchType: "none" });
    expect(findBottleInListCache(queryClient, ID)).toBeUndefined();
  });

  it('詳細の query（["bottles", id]）は一覧として扱わず、読むだけで何も書き込まない', () => {
    const queryClient = createQueryClient();
    const detail: Bottle = { ...item({ id: ID, name: "山崎" }), photos: [] };
    queryClient.setQueryData(queryKeys.bottle(ID), detail);
    expect(findBottleInListCache(queryClient, ID)).toBeUndefined();

    const target = item({ id: OTHER_ID, name: "別" });
    queryClient.setQueryData(openedKey, page({ items: [target] }));
    const before = queryClient.getQueryCache().getAll().length;
    expect(findBottleInListCache(queryClient, OTHER_ID)).toBe(target);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(before);
    expect(queryClient.getQueryData(queryKeys.bottle(OTHER_ID))).toBeUndefined();
  });

  it("形の違うデータが混ざっていても落ちない", () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(openedKey, null);
    queryClient.setQueryData(cellarKey, { pages: [null, "x"], pageParams: [] });
    expect(findBottleInListCache(queryClient, ID)).toBeUndefined();
  });
});
