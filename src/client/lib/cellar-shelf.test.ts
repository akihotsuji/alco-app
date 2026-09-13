import { describe, expect, it } from "vitest";
import type { BottleItem } from "@/shared/bottles.ts";
import { emptyCountsByType } from "@/shared/bottles.ts";
import {
  advanceTypeGridGesture,
  bottleTileVisual,
  capturePointerSafe,
  chunkShelfRows,
  edgeScrollDelta,
  groupBottlesByConsumedMonth,
  indexFromClientPoint,
  isBottleDetailPath,
  keepsTypeGrid,
  moveItem,
  parseCellarListView,
  parseDrinkTypeParam,
  pointerMovedBeyond,
  rankByCreatedAtDesc,
  resolveCellarListView,
  sameIdOrder,
  shelfColumns,
  shelfPageLimit,
  shelfRowIndex,
  shiftRectsForScroll,
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
    cellarId: "33333333-3333-4333-8333-333333333333",
    version: 1,
    createdByName: null,
    updatedByName: null,
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

describe("moveItem / sameIdOrder / hit test", () => {
  it("挿入で順列を入れ替え、範囲外は複製だけ返す", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 3)).toEqual(["a", "b"]);
  });

  it("id 列が同じときだけ同じ順とみなす", () => {
    expect(sameIdOrder([{ id: "1" }, { id: "2" }], [{ id: "1" }, { id: "2" }])).toBe(true);
    expect(sameIdOrder([{ id: "1" }, { id: "2" }], [{ id: "2" }, { id: "1" }])).toBe(false);
    expect(sameIdOrder([{ id: "1" }], [{ id: "1" }, { id: "2" }])).toBe(false);
  });

  it("ポインタに最も近いマスを返す", () => {
    const rects = [
      { left: 0, top: 0, width: 40, height: 40 },
      { left: 50, top: 0, width: 40, height: 40 },
      { left: 0, top: 50, width: 40, height: 40 },
    ];
    expect(indexFromClientPoint(10, 10, rects)).toBe(0);
    expect(indexFromClientPoint(70, 10, rects)).toBe(1);
    expect(indexFromClientPoint(10, 70, rects)).toBe(2);
    expect(indexFromClientPoint(0, 0, [])).toBe(0);
  });

  it("端付近だけスクロール量を返し、長押し判定は 10px", () => {
    expect(edgeScrollDelta(10, 0, 400, 56, 16)).toBe(-16);
    expect(edgeScrollDelta(390, 0, 400, 56, 16)).toBe(16);
    expect(edgeScrollDelta(200, 0, 400, 56, 16)).toBe(0);
    expect(pointerMovedBeyond(0, 0, 6, 6)).toBe(false);
    expect(pointerMovedBeyond(0, 0, 10, 0)).toBe(true);
  });

  it("長押し待ちの移動はスクロールへ、成立後は drag のまま", () => {
    const press = { kind: "press" as const, pointerId: 1, id: "a", x: 10, y: 40 };
    const still = advanceTypeGridGesture(press, {
      type: "move",
      pointerId: 1,
      clientX: 12,
      clientY: 42,
    });
    expect(still.gesture).toEqual(press);
    expect(still.scrollDy).toBe(0);

    const yielded = advanceTypeGridGesture(press, {
      type: "move",
      pointerId: 1,
      clientX: 10,
      clientY: 0,
    });
    expect(yielded.gesture).toEqual({ kind: "scroll", pointerId: 1, lastY: 0 });
    expect(yielded.scrollDy).toBe(40);

    const scrolling = advanceTypeGridGesture(yielded.gesture, {
      type: "move",
      pointerId: 1,
      clientX: 10,
      clientY: -8,
    });
    expect(scrolling.scrollDy).toBe(8);

    const lifted = advanceTypeGridGesture(press, { type: "longpress", id: "a" });
    expect(lifted.gesture).toEqual({ kind: "drag", pointerId: 1, id: "a" });
    expect(
      advanceTypeGridGesture(yielded.gesture, { type: "longpress", id: "a" }).gesture.kind,
    ).toBe("scroll");
    expect(advanceTypeGridGesture(lifted.gesture, { type: "up", pointerId: 1 }).gesture.kind).toBe(
      "idle",
    );
  });

  it("スクロールしたら持ち上げ時のマスだけ縦にずらす", () => {
    const rects = [{ left: 10, top: 80, width: 40, height: 40 }];
    expect(shiftRectsForScroll(rects, 0)[0]?.top).toBe(80);
    expect(shiftRectsForScroll(rects, 20)[0]?.top).toBe(60);
  });

  it("離れたポインタへの capture は投げず失敗を返す", () => {
    expect(
      capturePointerSafe(
        {
          setPointerCapture: () => {
            throw new DOMException("InvalidStateError");
          },
        },
        1,
      ),
    ).toBe(false);
    expect(
      capturePointerSafe(
        {
          setPointerCapture: () => {},
        },
        1,
      ),
    ).toBe(true);
  });

  it("ボトル詳細だけグリッドを残し、他のセラー経路は閉じる", () => {
    expect(isBottleDetailPath("/cellar/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(true);
    expect(isBottleDetailPath("/cellar/new")).toBe(false);
    expect(isBottleDetailPath("/cellar/archive")).toBe(false);
    expect(keepsTypeGrid("/cellar")).toBe(true);
    expect(keepsTypeGrid("/cellar/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(true);
    expect(keepsTypeGrid("/settings")).toBe(false);
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
