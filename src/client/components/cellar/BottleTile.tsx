import { Link } from "react-router";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { vintageLabel } from "@/client/lib/bottle-form.ts";
import type { BottleItem } from "@/shared/bottles.ts";
import { formatShortMonthDay } from "@/shared/tokyo-date.ts";

export type BottleTileMode = "cellar" | "archived";

type BottleTileProps = {
  item: BottleItem;
  mode: BottleTileMode;
  enter?: boolean;
};

export function BottleTile({ item, mode, enter }: BottleTileProps) {
  const photoId = item.thumbPhotoId;
  const kind = item.thumbPhotoKind;

  return (
    <Link className="bottle-tile" data-enter={enter ? "1" : undefined} to={`/cellar/${item.id}`}>
      <span className={mode === "archived" ? "bottle-tile-frame is-archived" : "bottle-tile-frame"}>
        {photoId ? (
          <img
            className={kind === "cutout" ? "bottle-tile-img is-cutout" : "bottle-tile-img is-photo"}
            src={photoContentUrl(photoId)}
            alt=""
            loading="lazy"
          />
        ) : (
          <BottleSilhouette className="bottle-tile-silhouette" />
        )}
        {mode === "archived" && item.consumedOn ? (
          <span className="bottle-tile-date">{formatShortMonthDay(item.consumedOn)}</span>
        ) : null}
      </span>
      <span className="bottle-tile-name">{item.name}</span>
      {mode === "cellar" ? (
        <span className="bottle-tile-sub">{vintageLabel(item.vintage)}</span>
      ) : null}
    </Link>
  );
}
