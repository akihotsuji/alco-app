import type { CSSProperties } from "react";
import { BottleTile, type BottleTileMode } from "@/client/components/cellar/BottleTile.tsx";
import { chunkShelfRows } from "@/client/lib/cellar-shelf.ts";
import type { BottleItem } from "@/shared/bottles.ts";

type ShelfProps = {
  items: readonly BottleItem[];
  columns: number;
  mode: BottleTileMode;
  highlightRow?: number | null;
  enterId?: string | null;
};

export function Shelf({ items, columns, mode, highlightRow, enterId }: ShelfProps) {
  const rows = chunkShelfRows(items, columns);
  return (
    <div className="shelf" style={{ "--shelf-cols": columns } as CSSProperties}>
      {rows.map((row, index) => (
        <div
          className="shelf-row"
          data-highlight={highlightRow === index ? "1" : undefined}
          key={row[0]?.id ?? String(index)}
        >
          <div className="shelf-row-items">
            {row.map((item) => (
              <BottleTile key={item.id} item={item} mode={mode} enter={enterId === item.id} />
            ))}
          </div>
          <div className="shelf-board" />
        </div>
      ))}
    </div>
  );
}

const SKELETON_ROWS = ["row-a", "row-b"] as const;
const SKELETON_TILES = ["tile-a", "tile-b", "tile-c", "tile-d"] as const;

export function ShelfSkeleton({ columns = 3, rows = 2 }: { columns?: number; rows?: number }) {
  const rowKeys = SKELETON_ROWS.slice(0, rows);
  const tiles = SKELETON_TILES.slice(0, columns);
  return (
    <div className="shelf" style={{ "--shelf-cols": columns } as CSSProperties} role="status">
      <span className="visually-hidden">読み込み中</span>
      {rowKeys.map((rowKey) => (
        <div className="shelf-row" key={rowKey}>
          <div className="shelf-row-items">
            {tiles.map((tileKey) => (
              <div className="bottle-tile-skeleton" key={`${rowKey}-${tileKey}`} />
            ))}
          </div>
          <div className="shelf-board" />
        </div>
      ))}
    </div>
  );
}
