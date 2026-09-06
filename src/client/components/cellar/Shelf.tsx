import { type CSSProperties, useRef } from "react";
import { BottleTile, type BottleTileMode } from "@/client/components/cellar/BottleTile.tsx";
import { LoadMoreSentinel } from "@/client/components/cellar/LoadMoreSentinel.tsx";
import { chunkShelfRows, typeShelfWidthPx } from "@/client/lib/cellar-shelf.ts";
import type { BottleItem } from "@/shared/bottles.ts";

export type ShelfLayout = "one" | "type";

type ShelfProps = {
  items: readonly BottleItem[];
  columns: number;
  mode: BottleTileMode;
  layout?: ShelfLayout;
  ghostLabel?: string;
  highlightRow?: number | null;
  enterId?: string | null;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
};

export function Shelf({
  items,
  columns,
  mode,
  layout = "one",
  ghostLabel,
  highlightRow,
  enterId,
  canLoadMore = false,
  onLoadMore,
}: ShelfProps) {
  if (layout === "type") {
    return (
      <TypeShelf
        items={items}
        mode={mode}
        ghostLabel={ghostLabel}
        highlight={highlightRow === 0}
        enterId={enterId}
        canLoadMore={canLoadMore}
        onLoadMore={onLoadMore}
      />
    );
  }

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

function TypeShelf({
  items,
  mode,
  ghostLabel,
  highlight,
  enterId,
  canLoadMore,
  onLoadMore,
}: {
  items: readonly BottleItem[];
  mode: BottleTileMode;
  ghostLabel?: string;
  highlight: boolean;
  enterId?: string | null;
  canLoadMore: boolean;
  onLoadMore?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = typeShelfWidthPx(items.length);

  return (
    <section className="shelf-type" data-highlight={highlight ? "1" : undefined}>
      {ghostLabel ? <p className="shelf-ghost">{ghostLabel}</p> : null}
      <div className="shelf-type-scroll" ref={scrollRef}>
        <div className="shelf-type-inner" style={{ minWidth: width }}>
          <div className="shelf-type-items">
            {items.map((item) => (
              <BottleTile
                key={item.id}
                item={item}
                mode={mode}
                size="type"
                enter={enterId === item.id}
              />
            ))}
            {onLoadMore ? (
              <LoadMoreSentinel
                className="shelf-type-sentinel"
                root={scrollRef}
                enabled={canLoadMore}
                onVisible={onLoadMore}
              />
            ) : null}
          </div>
          <div className="shelf-board" />
        </div>
      </div>
    </section>
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
