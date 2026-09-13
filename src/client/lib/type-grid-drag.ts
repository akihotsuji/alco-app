import {
  type ClientRectLike,
  indexFromClientPoint,
  moveItem,
  TYPE_GRID_COLUMNS,
  TYPE_GRID_EDGE_SCROLL_PX,
} from "@/client/lib/cellar-shelf.ts";

export const TYPE_GRID_HYSTERESIS_PX = 8;
export const TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC = 480;
export const TYPE_GRID_EDGE_SCROLL_MAX_DT_MS = 32;
export const TYPE_GRID_SETTLE_MS = 180;
export const TYPE_GRID_LIFT_PX = 4;
export const TYPE_GRID_ANNOUNCE_THROTTLE_MS = 800;

export type TypeGridPhase = "idle" | "press" | "scroll" | "drag" | "settling";
export type TypeGridSavePhase = "idle" | "saving" | "conflict" | "failed";

export function grabOffset(
  startRect: ClientRectLike,
  clientX: number,
  clientY: number,
): { grabX: number; grabY: number } {
  return {
    grabX: clientX - startRect.left,
    grabY: clientY - startRect.top,
  };
}

export function followLayerPosition(
  clientX: number,
  clientY: number,
  grabX: number,
  grabY: number,
): { x: number; y: number } {
  return {
    x: clientX - grabX,
    y: clientY - grabY,
  };
}

export function orderFromInsert(
  startIds: readonly string[],
  activeId: string,
  insertIndex: number,
): string[] {
  const without = startIds.filter((id) => id !== activeId);
  if (without.length === startIds.length) {
    return [...startIds];
  }
  const next = [...without];
  next.splice(Math.max(0, Math.min(insertIndex, without.length)), 0, activeId);
  return next;
}

export function sameIdList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function applyItemsOrder<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const map = new Map(items.map((item) => [item.id, item]));
  const next: T[] = [];
  for (const id of ids) {
    const item = map.get(id);
    if (item) {
      next.push(item);
    }
  }
  return next;
}

export function distanceToRectCenter(x: number, y: number, rect: ClientRectLike): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.hypot(x - cx, y - cy);
}

export function pointInRect(x: number, y: number, rect: ClientRectLike): boolean {
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  );
}

export function insertIndexFromPoint(
  clientX: number,
  clientY: number,
  rects: readonly ClientRectLike[],
  columns = TYPE_GRID_COLUMNS,
): number {
  if (rects.length === 0) {
    return 0;
  }
  const last = rects[rects.length - 1];
  if (last) {
    const rowStart = Math.floor((rects.length - 1) / columns) * columns;
    let rowTop = last.top;
    let rowBottom = last.top + last.height;
    for (let index = rowStart; index < rects.length; index += 1) {
      const rect = rects[index];
      if (!rect) {
        continue;
      }
      rowTop = Math.min(rowTop, rect.top);
      rowBottom = Math.max(rowBottom, rect.top + rect.height);
    }
    if (clientY >= rowTop && clientY <= rowBottom && clientX > last.left + last.width / 2) {
      return rects.length - 1;
    }
  }
  return indexFromClientPoint(clientX, clientY, rects);
}

export function pickInsertIndex(input: {
  clientX: number;
  clientY: number;
  rects: readonly ClientRectLike[];
  currentIndex: number;
  inShelf: boolean;
  hysteresisPx?: number;
  columns?: number;
}): number {
  if (input.rects.length === 0) {
    return 0;
  }
  const clampedCurrent = Math.max(0, Math.min(input.currentIndex, input.rects.length - 1));
  if (!input.inShelf) {
    return clampedCurrent;
  }
  const next = insertIndexFromPoint(
    input.clientX,
    input.clientY,
    input.rects,
    input.columns ?? TYPE_GRID_COLUMNS,
  );
  const currentRect = input.rects[clampedCurrent];
  const nextRect = input.rects[next];
  if (next === clampedCurrent || !currentRect || !nextRect) {
    return next;
  }
  const currentDist = distanceToRectCenter(input.clientX, input.clientY, currentRect);
  const nextDist = distanceToRectCenter(input.clientX, input.clientY, nextRect);
  if (currentDist - nextDist >= (input.hysteresisPx ?? TYPE_GRID_HYSTERESIS_PX)) {
    return next;
  }
  return clampedCurrent;
}

export function edgeBandPx(viewportHeight: number, edgePx = TYPE_GRID_EDGE_SCROLL_PX): number {
  if (viewportHeight <= 0) {
    return 0;
  }
  if (viewportHeight < edgePx * 2) {
    return viewportHeight / 2;
  }
  return edgePx;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function edgeScrollVelocityPxPerSec(
  clientY: number,
  viewportTop: number,
  viewportBottom: number,
  edgePx = TYPE_GRID_EDGE_SCROLL_PX,
  maxPxPerSec = TYPE_GRID_EDGE_SCROLL_MAX_PX_PER_SEC,
): number {
  const band = edgeBandPx(viewportBottom - viewportTop, edgePx);
  if (band <= 0 || clientY < viewportTop || clientY > viewportBottom) {
    return 0;
  }
  if (clientY <= viewportTop + band) {
    return -maxPxPerSec * clamp01((viewportTop + band - clientY) / band);
  }
  if (clientY >= viewportBottom - band) {
    return maxPxPerSec * clamp01((clientY - (viewportBottom - band)) / band);
  }
  return 0;
}

export function edgeScrollDeltaByTime(
  velocityPxPerSec: number,
  dtMs: number,
  maxDtMs = TYPE_GRID_EDGE_SCROLL_MAX_DT_MS,
): number {
  const dt = Math.min(Math.max(dtMs, 0), maxDtMs);
  return velocityPxPerSec * (dt / 1000);
}

export function typeGridCellPlacement(
  index: number,
  columns = TYPE_GRID_COLUMNS,
): { column: number; row: number } {
  return {
    column: (index % columns) + 1,
    row: Math.floor(index / columns) * 2 + 1,
  };
}

export function typeGridBoardRow(rowIndex: number): number {
  return rowIndex * 2 + 2;
}

export function typeGridRowCount(itemCount: number, columns = TYPE_GRID_COLUMNS): number {
  if (itemCount <= 0) {
    return 1;
  }
  return Math.ceil(itemCount / columns);
}

export function mergeExternalBottleSet<T extends { id: string }>(
  local: readonly T[],
  server: readonly T[],
): T[] {
  const serverById = new Map(server.map((item) => [item.id, item]));
  const localIds = new Set(local.map((item) => item.id));
  const added = server.filter((item) => !localIds.has(item.id));
  const kept: T[] = [];
  for (const item of local) {
    const current = serverById.get(item.id);
    if (current) {
      kept.push(current);
    }
  }
  return [...added, ...kept];
}

export function idSetKey(items: readonly { id: string }[]): string {
  return items
    .map((item) => item.id)
    .sort()
    .join(",");
}

export function shouldAcceptServerOrder(input: {
  phase: TypeGridPhase;
  savePhase: TypeGridSavePhase;
  dirty: boolean;
}): boolean {
  return input.phase === "idle" && input.savePhase === "idle" && !input.dirty;
}

export function canStartTypeGridReorder(input: {
  loadedAll: boolean;
  searchActive: boolean;
  saving: boolean;
  fetchError: boolean;
  count: number;
  phase: TypeGridPhase;
}): boolean {
  return (
    input.loadedAll &&
    !input.searchActive &&
    !input.saving &&
    !input.fetchError &&
    input.count >= 2 &&
    (input.phase === "idle" || input.phase === "settling")
  );
}

export type TypeGridSaveSnapshot = {
  drinkType: string;
  cellarId?: string;
  bottleIds: string[];
  operationKey: string;
};

export function nextSaveAttempt(input: {
  currentIds: readonly string[];
  lastAttempt: TypeGridSaveSnapshot | null;
  newKey: () => string;
  drinkType: string;
  cellarId?: string;
}): TypeGridSaveSnapshot {
  if (
    input.lastAttempt &&
    input.lastAttempt.drinkType === input.drinkType &&
    input.lastAttempt.cellarId === input.cellarId &&
    sameIdList(input.lastAttempt.bottleIds, input.currentIds)
  ) {
    return input.lastAttempt;
  }
  return {
    drinkType: input.drinkType,
    ...(input.cellarId ? { cellarId: input.cellarId } : {}),
    bottleIds: [...input.currentIds],
    operationKey: input.newKey(),
  };
}

export function saveSuccessMatchesCurrent(
  snapshotIds: readonly string[],
  currentIds: readonly string[],
): boolean {
  return sameIdList(snapshotIds, currentIds);
}

export function moveSelectedId(
  ids: readonly string[],
  selectedId: string,
  direction: -1 | 1,
): string[] {
  const from = ids.indexOf(selectedId);
  if (from < 0) {
    return [...ids];
  }
  return moveItem([...ids], from, from + direction);
}

export function typeGridLiveMessage(input: {
  kind: "moving" | "position" | "cancelled" | "assist-select";
  name: string;
  index: number;
  total: number;
}): string {
  const position = `全${input.total}本中${input.index + 1}番目`;
  if (input.kind === "moving") {
    return `${input.name}を移動中。${position}`;
  }
  if (input.kind === "position") {
    return `${input.name}は${position}`;
  }
  if (input.kind === "cancelled") {
    return "移動を取り消しました";
  }
  return `${input.name}を選択。${position}`;
}

export function shouldAnnouncePosition(
  lastAt: number,
  now: number,
  throttleMs = TYPE_GRID_ANNOUNCE_THROTTLE_MS,
): boolean {
  return now - lastAt >= throttleMs;
}

export function shouldIgnorePointer(
  sessionPointerId: number | null,
  eventPointerId: number,
  phase: TypeGridPhase,
): boolean {
  if (phase === "idle" || phase === "settling") {
    return false;
  }
  return sessionPointerId !== null && sessionPointerId !== eventPointerId;
}

export function isCurrentGeneration(current: number, expected: number): boolean {
  return current === expected;
}

export function readCssDurationMs(
  styles: { getPropertyValue: (name: string) => string },
  name: string,
  fallback: number,
): number {
  const raw = styles.getPropertyValue(name).trim();
  if (raw.endsWith("ms")) {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  }
  if (raw.endsWith("s")) {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value * 1000 : fallback;
  }
  return fallback;
}

export function invertFlip(
  first: ClientRectLike,
  last: ClientRectLike,
): { dx: number; dy: number } {
  return {
    dx: first.left - last.left,
    dy: first.top - last.top,
  };
}
