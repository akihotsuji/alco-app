import type { BottleItem, CountsByType } from "@/shared/bottles.ts";
import {
  type CellarListView,
  DEFAULT_CELLAR_LIST_VIEW,
  DRINK_TYPES,
  type DrinkType,
  type PhotoKind,
} from "@/shared/constants.ts";
import { formatYearMonth, parseCalendarDate } from "@/shared/tokyo-date.ts";

export const SHELF_COLUMNS_NARROW = 3;
export const SHELF_COLUMNS_WIDE = 4;
export const SHELF_WIDE_MIN_PX = 480;
export const SHELF_TYPE_PAGE_LIMIT = 12;
export const SHELF_TYPE_TILE_PX = 72;
export const SHELF_TYPE_GAP_PX = 22;
export const TYPE_GRID_COLUMNS = 4;
export const TYPE_GRID_PAGE_LIMIT = 100;
export const TYPE_GRID_GAP_PX = 12;
export const TYPE_GRID_LONG_PRESS_MS = 400;
export const TYPE_GRID_MOVE_THRESHOLD_PX = 10;
export const TYPE_GRID_EDGE_SCROLL_PX = 56;
export const TYPE_GRID_EDGE_SCROLL_STEP_PX = 16;
export const TYPE_GRID_HISTORY_FLAG = "alcoTypeGrid";

export function shelfColumns(width: number): number {
  return width >= SHELF_WIDE_MIN_PX ? SHELF_COLUMNS_WIDE : SHELF_COLUMNS_NARROW;
}

export function shelfRowIndex(rank: number, columns: number): number {
  if (rank < 0 || columns <= 0) {
    return 0;
  }
  return Math.floor(rank / columns);
}

export function shelfPageLimit(columns: number): number {
  return columns * 2;
}

export function parseCellarListView(raw: string | null | undefined): CellarListView | null {
  return raw === "one" || raw === "type" ? raw : null;
}

/** URL の drinkType。未知値はフィルタなし（404 にしない） */
export function parseDrinkTypeParam(raw: string | null | undefined): DrinkType | undefined {
  return raw && (DRINK_TYPES as readonly string[]).includes(raw) ? (raw as DrinkType) : undefined;
}

export function resolveCellarListView(
  urlView: string | null | undefined,
  storedView: string | null | undefined,
): CellarListView {
  return (
    parseCellarListView(urlView) ?? parseCellarListView(storedView) ?? DEFAULT_CELLAR_LIST_VIEW
  );
}

export function visibleDrinkTypes(counts: CountsByType): DrinkType[] {
  return DRINK_TYPES.filter((type) => counts[type] > 0);
}

export function typeShelfWidthPx(count: number): number {
  const bottles = Math.max(1, count);
  return bottles * SHELF_TYPE_TILE_PX + (bottles - 1) * SHELF_TYPE_GAP_PX;
}

export function bottleTileVisual(
  thumbPhotoId: string | null,
  thumbPhotoKind: PhotoKind | null,
): "cutout" | "photo" | "silhouette" {
  if (!thumbPhotoId || !thumbPhotoKind) {
    return "silhouette";
  }
  return thumbPhotoKind;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [picked] = next.splice(from, 1);
  if (picked === undefined) {
    return [...items];
  }
  next.splice(to, 0, picked);
  return next;
}

export function sameIdOrder(
  left: readonly { id: string }[],
  right: readonly { id: string }[],
): boolean {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}

export type ClientRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** ポインタに最も近いマスの添字（ドラッグ中の挿入先） */
export function indexFromClientPoint(
  clientX: number,
  clientY: number,
  rects: readonly ClientRectLike[],
): number {
  if (rects.length === 0) {
    return 0;
  }
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (!rect) {
      continue;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = (clientX - cx) ** 2 + (clientY - cy) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

export function edgeScrollDelta(
  clientY: number,
  viewportTop: number,
  viewportBottom: number,
  edgePx = TYPE_GRID_EDGE_SCROLL_PX,
  stepPx = TYPE_GRID_EDGE_SCROLL_STEP_PX,
): number {
  if (clientY < viewportTop + edgePx) {
    return -stepPx;
  }
  if (clientY > viewportBottom - edgePx) {
    return stepPx;
  }
  return 0;
}

export function pointerMovedBeyond(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx = TYPE_GRID_MOVE_THRESHOLD_PX,
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}

export type TypeGridGesture =
  | { kind: "idle" }
  | { kind: "press"; pointerId: number; id: string; x: number; y: number }
  | { kind: "scroll"; pointerId: number; lastY: number }
  | { kind: "drag"; pointerId: number; id: string };

/**
 * 長押し待ち中にブラウザへポインタを渡すと `pointercancel` で並べ替えが死ぬ。
 * 閾値を超えた移動はリストの手動スクロールへ切り替え、成立後だけ drag にする。
 */
export function advanceTypeGridGesture(
  gesture: TypeGridGesture,
  input:
    | { type: "move"; pointerId: number; clientX: number; clientY: number }
    | { type: "longpress"; id: string }
    | { type: "up"; pointerId: number },
): { gesture: TypeGridGesture; scrollDy: number } {
  if (input.type === "up") {
    if (gesture.kind === "idle" || gesture.pointerId !== input.pointerId) {
      return { gesture, scrollDy: 0 };
    }
    return { gesture: { kind: "idle" }, scrollDy: 0 };
  }
  if (input.type === "longpress") {
    if (gesture.kind !== "press" || gesture.id !== input.id) {
      return { gesture, scrollDy: 0 };
    }
    return { gesture: { kind: "drag", pointerId: gesture.pointerId, id: gesture.id }, scrollDy: 0 };
  }
  if (gesture.kind === "press" && gesture.pointerId === input.pointerId) {
    if (pointerMovedBeyond(gesture.x, gesture.y, input.clientX, input.clientY)) {
      return {
        gesture: { kind: "scroll", pointerId: input.pointerId, lastY: input.clientY },
        scrollDy: gesture.y - input.clientY,
      };
    }
    return { gesture, scrollDy: 0 };
  }
  if (gesture.kind === "scroll" && gesture.pointerId === input.pointerId) {
    return {
      gesture: { kind: "scroll", pointerId: input.pointerId, lastY: input.clientY },
      scrollDy: gesture.lastY - input.clientY,
    };
  }
  return { gesture, scrollDy: 0 };
}

export function capturePointerSafe(
  target: { setPointerCapture: (pointerId: number) => void },
  pointerId: number,
): void {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // 指が既に離れていると InvalidStateError
  }
}

const CELLAR_DETAIL_RESERVED = new Set(["new", "archive", "batch", "share"]);

/** `/cellar/:bottleId`（追加・貯蔵庫・共有は除く） */
export function isBottleDetailPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const id = segments[1];
  return (
    segments.length === 2 &&
    segments[0] === "cellar" &&
    id !== undefined &&
    !CELLAR_DETAIL_RESERVED.has(id)
  );
}

export function keepsTypeGrid(pathname: string): boolean {
  return pathname === "/cellar" || isBottleDetailPath(pathname);
}

export function chunkShelfRows<T>(items: readonly T[], columns: number): T[][] {
  if (columns <= 0) {
    return items.length === 0 ? [] : [[...items]];
  }
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

type RankedBottle = {
  id: string;
  createdAt: string;
};

/** `createdAt` 降順・同値は `id` 降順（一覧 API と同じ） */
export function rankByCreatedAtDesc(
  items: readonly RankedBottle[],
  target: { bottleId: string; createdAt: string },
): number {
  const all = items.some((item) => item.id === target.bottleId)
    ? [...items]
    : [...items, { id: target.bottleId, createdAt: target.createdAt }];
  all.sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt < right.createdAt ? 1 : -1;
    }
    return left.id < right.id ? 1 : -1;
  });
  return all.findIndex((item) => item.id === target.bottleId);
}

export type ArchiveMonthGroup = {
  monthKey: string;
  label: string;
  items: BottleItem[];
};

export function groupBottlesByConsumedMonth(items: readonly BottleItem[]): ArchiveMonthGroup[] {
  const groups: ArchiveMonthGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const consumedOn = item.consumedOn;
    if (!consumedOn || !parseCalendarDate(consumedOn)) {
      continue;
    }
    const monthKey = consumedOn.slice(0, 7);
    const existing = indexByKey.get(monthKey);
    if (existing === undefined) {
      indexByKey.set(monthKey, groups.length);
      groups.push({
        monthKey,
        label: formatYearMonth(consumedOn),
        items: [item],
      });
    } else {
      groups[existing]?.items.push(item);
    }
  }
  return groups;
}
