import type { BottleItem } from "@/shared/bottles.ts";
import { formatYearMonth, parseCalendarDate } from "@/shared/tokyo-date.ts";

export const SHELF_COLUMNS_NARROW = 3;
export const SHELF_COLUMNS_WIDE = 4;
export const SHELF_WIDE_MIN_PX = 480;

export function shelfColumns(width: number): number {
  return width >= SHELF_WIDE_MIN_PX ? SHELF_COLUMNS_WIDE : SHELF_COLUMNS_NARROW;
}

export function shelfRowIndex(rank: number, columns: number): number {
  if (rank < 0 || columns <= 0) {
    return 0;
  }
  return Math.floor(rank / columns);
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
