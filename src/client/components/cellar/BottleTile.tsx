import { useState } from "react";
import { Link } from "react-router";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import {
  ContentPhoto,
  type ContentPhotoState,
  PHOTO_DISPLAY_SIZE,
} from "@/client/components/photo/ContentPhoto.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { vintageLabel } from "@/client/lib/bottle-form.ts";
import { bottleTileVisual } from "@/client/lib/cellar-shelf.ts";
import { cn } from "@/client/lib/utils.ts";
import type { BottleItem } from "@/shared/bottles.ts";
import { formatShortMonthDay } from "@/shared/tokyo-date.ts";

export type BottleTileMode = "cellar" | "archived";
export type BottleTileSize = "one" | "type";

type BottleTileProps = {
  item: BottleItem;
  mode: BottleTileMode;
  size?: BottleTileSize;
  enter?: boolean;
};

export function BottleTile({ item, mode, size = "one", enter }: BottleTileProps) {
  const visual = bottleTileVisual(item.thumbPhotoId, item.thumbPhotoKind);
  const showSub = mode === "cellar" && size === "one";
  const [photoState, setPhotoState] = useState<ContentPhotoState>("loading");

  return (
    <Link
      className={cn("bottle-tile", size === "type" && "is-type")}
      data-enter={enter ? "1" : undefined}
      to={`/cellar/${item.id}`}
    >
      <span className={mode === "archived" ? "bottle-tile-frame is-archived" : "bottle-tile-frame"}>
        {visual === "silhouette" || !item.thumbPhotoId ? (
          <BottleSilhouette className="bottle-tile-silhouette" drinkType={item.drinkType} />
        ) : (
          <>
            {/* 写真が届くまでは種類のボトル型を置き、到着で写真とクロスフェード（00-common 2.5 / M-29） */}
            <span className="bottle-tile-placeholder" data-state={photoState}>
              <BottleSilhouette className="bottle-tile-silhouette" drinkType={item.drinkType} />
            </span>
            <ContentPhoto
              className={
                visual === "cutout" ? "bottle-tile-img is-cutout" : "bottle-tile-img is-photo"
              }
              src={photoContentUrl(item.thumbPhotoId)}
              size={PHOTO_DISPLAY_SIZE.bottleTile}
              onStateChange={setPhotoState}
            />
          </>
        )}
        {mode === "archived" && item.consumedOn ? (
          <span className="bottle-tile-date">{formatShortMonthDay(item.consumedOn)}</span>
        ) : null}
      </span>
      <span className="bottle-tile-name">{item.name}</span>
      {showSub ? <span className="bottle-tile-sub">{vintageLabel(item.vintage)}</span> : null}
    </Link>
  );
}
