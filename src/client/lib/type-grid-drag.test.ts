import { describe, expect, it } from "vitest";
import {
  applyItemsOrder,
  canStartTypeGridReorder,
  edgeBandPx,
  edgeScrollDeltaByTime,
  edgeScrollVelocityPxPerSec,
  followLayerPosition,
  grabOffset,
  idSetKey,
  insertIndexFromPoint,
  invertFlip,
  isCurrentGeneration,
  isSignificantViewportChange,
  mergeExternalBottleSet,
  moveSelectedId,
  nextSaveAttempt,
  orderFromInsert,
  pickInsertIndex,
  pointInRect,
  readCssDurationMs,
  sameIdList,
  saveSuccessMatchesCurrent,
  shouldAcceptServerOrder,
  shouldAnnouncePosition,
  shouldIgnorePointer,
  shouldTreatLostCaptureAsInterrupt,
  TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC,
  TYPE_GRID_HYSTERESIS_PX,
  typeGridBoardRow,
  typeGridCellPlacement,
  typeGridLiveMessage,
  typeGridRowCount,
} from "./type-grid-drag.ts";

const rect = (left: number, top: number, width = 40, height = 40) => ({
  left,
  top,
  width,
  height,
});

describe("followLayerPosition / grabOffset", () => {
  it("押下位置からの相対で追従座標を出す", () => {
    const start = rect(100, 200, 80, 120);
    const grab = grabOffset(start, 130, 240);
    expect(grab).toEqual({ grabX: 30, grabY: 40 });
    expect(followLayerPosition(150, 260, grab.grabX, grab.grabY)).toEqual({ x: 120, y: 220 });
  });

  it("同一マス内の移動でも追従矩形が動く", () => {
    const grab = { grabX: 10, grabY: 10 };
    const a = followLayerPosition(20, 20, grab.grabX, grab.grabY);
    const b = followLayerPosition(28, 24, grab.grabX, grab.grabY);
    expect(a).toEqual({ x: 10, y: 10 });
    expect(b).toEqual({ x: 18, y: 14 });
    expect(a).not.toEqual(b);
  });
});

describe("orderFromInsert", () => {
  it("交換ではなく挿入する", () => {
    expect(orderFromInsert(["A", "B", "C", "D", "E"], "B", 3)).toEqual(["A", "C", "D", "B", "E"]);
    expect(orderFromInsert(["A", "B", "C", "D", "E"], "A", 1)).toEqual(["B", "A", "C", "D", "E"]);
    expect(orderFromInsert(["A", "B", "C", "D", "E"], "A", 4)).toEqual(["B", "C", "D", "E", "A"]);
    expect(orderFromInsert(["A", "B", "C", "D", "E"], "E", 0)).toEqual(["E", "A", "B", "C", "D"]);
    expect(orderFromInsert(["A", "B", "C", "D", "E"], "D", 3)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("未知のIDや範囲外indexでも配列を壊さない", () => {
    expect(orderFromInsert(["A", "B"], "Z", 1)).toEqual(["A", "B"]);
    expect(orderFromInsert(["A", "B", "C"], "B", 99)).toEqual(["A", "C", "B"]);
    expect(orderFromInsert(["A", "B", "C"], "B", -3)).toEqual(["B", "A", "C"]);
  });
});

describe("pickInsertIndex / last row leftover", () => {
  const slots = [rect(0, 0), rect(50, 0), rect(100, 0), rect(150, 0), rect(0, 60)];

  it("最寄り中心を土台にし、8px以上近いときだけ切り替える", () => {
    const current = pickInsertIndex({
      clientX: 20,
      clientY: 20,
      rects: slots,
      currentIndex: 0,
      inShelf: true,
    });
    expect(current).toBe(0);

    const almost = pickInsertIndex({
      clientX: 48,
      clientY: 20,
      rects: slots,
      currentIndex: 0,
      inShelf: true,
      hysteresisPx: TYPE_GRID_HYSTERESIS_PX,
    });
    expect(almost).toBe(0);

    const switched = pickInsertIndex({
      clientX: 70,
      clientY: 20,
      rects: slots,
      currentIndex: 0,
      inShelf: true,
    });
    expect(switched).toBe(1);
  });

  it("棚外では最後の有効候補を維持する", () => {
    expect(
      pickInsertIndex({
        clientX: -40,
        clientY: -40,
        rects: slots,
        currentIndex: 3,
        inShelf: false,
      }),
    ).toBe(3);
  });

  it("最終段の余白は末尾への挿入にする", () => {
    expect(insertIndexFromPoint(180, 70, slots, 4)).toBe(4);
    expect(insertIndexFromPoint(20, 20, slots, 4)).toBe(0);
  });

  it("1→2、4→5、5→4、斜めの候補を返す", () => {
    expect(insertIndexFromPoint(70, 20, slots, 4)).toBe(1);
    expect(insertIndexFromPoint(20, 70, slots, 4)).toBe(4);
    expect(insertIndexFromPoint(20, 20, [slots[4] ?? rect(0, 60), ...slots.slice(0, 4)], 4)).toBe(
      1,
    );
  });
});

describe("edge scroll time scaling", () => {
  it("端への入り込みに応じて0から最大480px/秒まで増やす", () => {
    expect(edgeScrollVelocityPxPerSec(200, 0, 400)).toBe(0);
    expect(edgeScrollVelocityPxPerSec(0, 0, 400)).toBe(-TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC);
    expect(edgeScrollVelocityPxPerSec(400, 0, 400)).toBe(TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC);
    expect(edgeScrollVelocityPxPerSec(28, 0, 400)).toBe(-TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC / 2);
    expect(edgeScrollVelocityPxPerSec(-1, 0, 400)).toBe(0);
  });

  it("60Hzと120Hz相当のdtで同じ速度なら移動距離が一致する", () => {
    const velocity = 480;
    const over60 = edgeScrollDeltaByTime(velocity, 16) * 2;
    const over120 = edgeScrollDeltaByTime(velocity, 8) * 4;
    expect(over60).toBeCloseTo(over120, 5);
    expect(edgeScrollDeltaByTime(velocity, 16)).toBeCloseTo(7.68, 5);
    expect(edgeScrollDeltaByTime(velocity, 64)).toBe(edgeScrollDeltaByTime(velocity, 32));
    expect(edgeScrollDeltaByTime(velocity, 0)).toBe(0);
  });

  it("小さい高さでは帯を縮める", () => {
    expect(edgeBandPx(80)).toBe(40);
    expect(edgeBandPx(200)).toBe(56);
    expect(edgeBandPx(0)).toBe(0);
  });
});

describe("grid placement", () => {
  it("ボトルと棚板の行を挿入順から決める", () => {
    expect(typeGridCellPlacement(0)).toEqual({ column: 1, row: 1 });
    expect(typeGridCellPlacement(3)).toEqual({ column: 4, row: 1 });
    expect(typeGridCellPlacement(4)).toEqual({ column: 1, row: 3 });
    expect(typeGridBoardRow(0)).toBe(2);
    expect(typeGridBoardRow(1)).toBe(4);
    expect(typeGridRowCount(5)).toBe(2);
    expect(typeGridRowCount(0)).toBe(1);
  });
});

describe("save / external set", () => {
  it("idleかつ未変更のときだけサーバー順を取り込む", () => {
    expect(shouldAcceptServerOrder({ phase: "idle", savePhase: "idle", dirty: false })).toBe(true);
    expect(shouldAcceptServerOrder({ phase: "drag", savePhase: "idle", dirty: false })).toBe(false);
    expect(shouldAcceptServerOrder({ phase: "idle", savePhase: "saving", dirty: true })).toBe(
      false,
    );
    expect(shouldAcceptServerOrder({ phase: "idle", savePhase: "idle", dirty: true })).toBe(false);
  });

  it("同じID順の再試行はoperationKeyを維持し、別順は新しいkeyにする", () => {
    const first = nextSaveAttempt({
      currentIds: ["a", "b"],
      lastAttempt: null,
      newKey: () => "key-1",
      drinkType: "wine_red",
    });
    expect(first.operationKey).toBe("key-1");
    const retry = nextSaveAttempt({
      currentIds: ["a", "b"],
      lastAttempt: first,
      newKey: () => "key-2",
      drinkType: "wine_red",
    });
    expect(retry.operationKey).toBe("key-1");
    const changed = nextSaveAttempt({
      currentIds: ["b", "a"],
      lastAttempt: first,
      newKey: () => "key-3",
      drinkType: "wine_red",
    });
    expect(changed.operationKey).toBe("key-3");
    expect(saveSuccessMatchesCurrent(["a", "b"], ["a", "b"])).toBe(true);
    expect(saveSuccessMatchesCurrent(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("集合変化では消えたIDを残さず、順序だけの外部変更ではローカル順を保つ", () => {
    const local = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const serverReordered = [{ id: "c" }, { id: "b" }, { id: "a" }];
    expect(mergeExternalBottleSet(local, serverReordered).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    const serverRemoved = [{ id: "a" }, { id: "c" }, { id: "d" }];
    expect(mergeExternalBottleSet(local, serverRemoved).map((item) => item.id)).toEqual([
      "d",
      "a",
      "c",
    ]);
    expect(idSetKey(local)).not.toBe(idSetKey(serverRemoved));
  });

  it("並べ替え開始条件を守る", () => {
    const ok = {
      loadedAll: true,
      searchActive: false,
      saving: false,
      fetchError: false,
      count: 2,
      phase: "idle" as const,
    };
    expect(canStartTypeGridReorder(ok)).toBe(true);
    expect(canStartTypeGridReorder({ ...ok, count: 1 })).toBe(false);
    expect(canStartTypeGridReorder({ ...ok, searchActive: true })).toBe(false);
    expect(canStartTypeGridReorder({ ...ok, saving: true })).toBe(false);
    expect(canStartTypeGridReorder({ ...ok, loadedAll: false })).toBe(false);
    expect(canStartTypeGridReorder({ ...ok, phase: "drag" })).toBe(false);
  });
});

describe("assist / a11y / generation", () => {
  it("選択中のボトルを前後へ移動する", () => {
    expect(moveSelectedId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveSelectedId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveSelectedId(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });

  it("意味のある変化だけ読み上げ文を作る", () => {
    expect(typeGridLiveMessage({ kind: "moving", name: "山の赤", index: 2, total: 5 })).toBe(
      "山の赤を移動中。全5本中3番目",
    );
    expect(typeGridLiveMessage({ kind: "cancelled", name: "山の赤", index: 0, total: 5 })).toBe(
      "移動を取り消しました",
    );
    expect(shouldAnnouncePosition(0, 799)).toBe(false);
    expect(shouldAnnouncePosition(0, 800)).toBe(true);
  });

  it("2本目の指と世代違いの完了を無視する", () => {
    expect(shouldIgnorePointer(1, 2, "drag")).toBe(true);
    expect(shouldIgnorePointer(1, 1, "drag")).toBe(false);
    expect(shouldIgnorePointer(1, 2, "idle")).toBe(false);
    expect(isCurrentGeneration(3, 2)).toBe(false);
    expect(isCurrentGeneration(3, 3)).toBe(true);
    expect(
      shouldTreatLostCaptureAsInterrupt({
        ending: true,
        transferringCapture: false,
        phase: "drag",
        stillCaptured: false,
      }),
    ).toBe(false);
    expect(
      shouldTreatLostCaptureAsInterrupt({
        ending: false,
        transferringCapture: true,
        phase: "drag",
        stillCaptured: false,
      }),
    ).toBe(false);
    expect(
      shouldTreatLostCaptureAsInterrupt({
        ending: false,
        transferringCapture: false,
        phase: "drag",
        stillCaptured: true,
      }),
    ).toBe(false);
    expect(
      shouldTreatLostCaptureAsInterrupt({
        ending: false,
        transferringCapture: false,
        phase: "drag",
        stillCaptured: false,
      }),
    ).toBe(true);
    expect(
      isSignificantViewportChange({ width: 412, height: 915 }, { width: 412, height: 900 }),
    ).toBe(false);
    expect(
      isSignificantViewportChange({ width: 412, height: 915 }, { width: 915, height: 412 }),
    ).toBe(true);
  });
});

describe("misc helpers", () => {
  it("applyItemsOrder は無いIDを落とす", () => {
    expect(applyItemsOrder([{ id: "a" }, { id: "b" }], ["b", "z", "a"])).toEqual([
      { id: "b" },
      { id: "a" },
    ]);
    expect(sameIdList(["a", "b"], ["a", "b"])).toBe(true);
    expect(pointInRect(10, 10, rect(0, 0, 20, 20))).toBe(true);
    expect(invertFlip(rect(30, 10), rect(10, 10))).toEqual({ dx: 20, dy: 0 });
  });

  it("CSS時間トークンをmsに直す", () => {
    const styles = {
      getPropertyValue: (name: string) => {
        if (name === "--dur-state") {
          return "200ms";
        }
        if (name === "--dur-type-grid-settle") {
          return "0.18s";
        }
        return "";
      },
    };
    expect(readCssDurationMs(styles, "--dur-state", 160)).toBe(200);
    expect(readCssDurationMs(styles, "--dur-type-grid-settle", 180)).toBe(180);
    expect(readCssDurationMs(styles, "--missing", 160)).toBe(160);
  });
});
