import { describe, expect, it } from "vitest";
import type { BottleItem } from "@/shared/bottles.ts";
import { emptyCountsByType } from "@/shared/bottles.ts";
import {
  bottleTileVisual,
  chunkShelfRows,
  groupBottlesByConsumedMonth,
  parseCellarListView,
  parseDrinkTypeParam,
  rankByCreatedAtDesc,
  resolveCellarListView,
  shelfColumns,
  shelfPageLimit,
  shelfRowIndex,
  typeShelfWidthPx,
  visibleDrinkTypes,
} from "./cellar-shelf.ts";
import { applyCellarToolbarParams } from "./history-state.ts";

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
    status: "consumed",
    consumedAt: "2026-09-05T00:00:00.000Z",
    consumedOn: "2026-09-05",
    thumbPhotoId: null,
    thumbPhotoKind: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    ...partial,
  };
}

describe("shelfColumns / shelfRowIndex", () => {
  it("480px 未満は 3 列、以上は 4 列", () => {
    expect(shelfColumns(390)).toBe(3);
    expect(shelfColumns(479)).toBe(3);
    expect(shelfColumns(480)).toBe(4);
  });

  it("順位から段を求める", () => {
    expect(shelfRowIndex(0, 3)).toBe(0);
    expect(shelfRowIndex(2, 3)).toBe(0);
    expect(shelfRowIndex(3, 3)).toBe(1);
    expect(shelfRowIndex(7, 4)).toBe(1);
  });
});

describe("shelfPageLimit / list view / type shelf", () => {
  it("2 段ずつ読む件数は列数の 2 倍", () => {
    expect(shelfPageLimit(3)).toBe(6);
    expect(shelfPageLimit(4)).toBe(8);
  });

  it("?view= が不正なら localStorage、それも無ければ one", () => {
    expect(parseCellarListView("type")).toBe("type");
    expect(parseCellarListView("foo")).toBeNull();
    expect(resolveCellarListView("foo", "type")).toBe("type");
    expect(resolveCellarListView(null, null)).toBe("one");
    expect(resolveCellarListView("one", "type")).toBe("one");
  });

  it("未知の drinkType はフィルタなし", () => {
    expect(parseDrinkTypeParam("wine")).toBe("wine");
    expect(parseDrinkTypeParam("evil")).toBeUndefined();
    expect(parseDrinkTypeParam(null)).toBeUndefined();
  });

  it("在庫 0 の種類は出さず、棚板幅は本数分", () => {
    const counts = { ...emptyCountsByType(), wine: 6, whisky: 2 };
    expect(visibleDrinkTypes(counts)).toEqual(["wine", "whisky"]);
    expect(typeShelfWidthPx(1)).toBe(72);
    expect(typeShelfWidthPx(3)).toBe(72 * 3 + 22 * 2);
    expect(typeShelfWidthPx(0)).toBe(72);
  });

  it("写真なしと kind で描き分ける", () => {
    expect(bottleTileVisual(null, "photo")).toBe("silhouette");
    expect(bottleTileVisual("p1", "cutout")).toBe("cutout");
    expect(bottleTileVisual("p1", "photo")).toBe("photo");
  });
});

describe("applyCellarToolbarParams", () => {
  it("種類選択と検索で一覧が絞られ、解除で戻る", () => {
    const items = [
      item({
        id: "1",
        name: "山の赤",
        drinkType: "wine",
        producer: "山の生産者",
        status: "sealed",
      }),
      item({ id: "2", name: "別の白", drinkType: "wine", status: "sealed" }),
      item({ id: "3", name: "ラガー", drinkType: "beer", status: "sealed" }),
    ];
    let params = new URLSearchParams("view=one");
    const wine = applyCellarToolbarParams(params, { type: "selectDrinkType", drinkType: "wine" });
    expect(wine?.get("drinkType")).toBe("wine");
    expect(wine?.get("view")).toBe("one");
    params = wine ?? params;
    expect(itemsMatchingToolbar(items, params).map((row) => row.id)).toEqual(["1", "2"]);

    const searched = applyCellarToolbarParams(params, { type: "setQuery", q: "山の" });
    params = searched ?? params;
    expect(itemsMatchingToolbar(items, params).map((row) => row.id)).toEqual(["1"]);

    const clearedType = applyCellarToolbarParams(params, { type: "clearDrinkType" });
    params = clearedType ?? params;
    expect(params.get("q")).toBe("山の");
    expect(params.get("drinkType")).toBeNull();
    expect(itemsMatchingToolbar(items, params).map((row) => row.id)).toEqual(["1"]);

    const cleared = applyCellarToolbarParams(params, { type: "clearFilters" });
    expect(cleared?.toString()).toBe("view=one");
    expect(itemsMatchingToolbar(items, cleared ?? params).map((row) => row.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
});

describe("chunkShelfRows", () => {
  it("最後の段が足りなくても残す", () => {
    expect(chunkShelfRows(["a", "b", "c", "d"], 3)).toEqual([["a", "b", "c"], ["d"]]);
    expect(chunkShelfRows([], 3)).toEqual([]);
  });
});

describe("rankByCreatedAtDesc", () => {
  it("抜けた本を一覧に戻して順位を付ける", () => {
    const items = [
      { id: "c", createdAt: "2026-09-03T00:00:00.000Z" },
      { id: "a", createdAt: "2026-09-01T00:00:00.000Z" },
    ];
    expect(
      rankByCreatedAtDesc(items, { bottleId: "b", createdAt: "2026-09-02T00:00:00.000Z" }),
    ).toBe(1);
    expect(
      rankByCreatedAtDesc(items, { bottleId: "c", createdAt: "2026-09-03T00:00:00.000Z" }),
    ).toBe(0);
  });

  it("createdAt 同値は id 降順", () => {
    const at = "2026-09-01T00:00:00.000Z";
    const items = [
      { id: "b", createdAt: at },
      { id: "a", createdAt: at },
    ];
    expect(rankByCreatedAtDesc(items, { bottleId: "c", createdAt: at })).toBe(0);
  });
});

describe("groupBottlesByConsumedMonth", () => {
  it("consumedOn の月で区切り、出現順（降順の items）を保つ", () => {
    const items = [
      item({ id: "1", name: "9月新しい", consumedOn: "2026-09-05" }),
      item({ id: "2", name: "9月古い", consumedOn: "2026-09-01" }),
      item({ id: "3", name: "8月", consumedOn: "2026-08-20" }),
    ];
    const groups = groupBottlesByConsumedMonth(items);
    expect(groups.map((group) => group.label)).toEqual(["2026年9月", "2026年8月"]);
    expect(groups[0]?.items.map((row) => row.name)).toEqual(["9月新しい", "9月古い"]);
    expect(groups[1]?.items.map((row) => row.name)).toEqual(["8月"]);
  });

  it("不正な開栓日は落とす", () => {
    expect(groupBottlesByConsumedMonth([item({ id: "1", name: "欠", consumedOn: null })])).toEqual(
      [],
    );
  });
});

function itemsMatchingToolbar(items: BottleItem[], params: URLSearchParams): BottleItem[] {
  const q = params.get("q") ?? "";
  const drinkType = parseDrinkTypeParam(params.get("drinkType"));
  return items.filter((row) => {
    if (drinkType && row.drinkType !== drinkType) {
      return false;
    }
    if (!q) {
      return true;
    }
    return row.name.includes(q) || (row.producer ?? "").includes(q);
  });
}
