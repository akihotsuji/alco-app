import type { RefObject } from "react";
import { BottleTileFace } from "@/client/components/cellar/BottleTile.tsx";
import type { BottleItem } from "@/shared/bottles.ts";

export type TypeGridFollowState = {
  item: BottleItem;
  width: number;
  readySrc: string | null;
};

type TypeGridDragPreviewProps = {
  follow: TypeGridFollowState | null;
  layerRef: RefObject<HTMLDivElement | null>;
  lifted: boolean;
};

export function TypeGridDragPreview({ follow, layerRef, lifted }: TypeGridDragPreviewProps) {
  return (
    <div ref={layerRef} className="type-grid-follow" aria-hidden="true">
      {follow ? (
        <div
          className="type-grid-follow-inner"
          data-lifted={lifted ? "1" : undefined}
          style={{ width: follow.width }}
        >
          <div className="bottle-tile is-type">
            <BottleTileFace
              item={follow.item}
              mode="cellar"
              size="type"
              readySrc={follow.readySrc}
              photoLoading="eager"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
