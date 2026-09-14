import { Link } from "react-router";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { vintageLabel } from "@/client/lib/bottle-form.ts";
import { bottleTileVisual } from "@/client/lib/cellar-shelf.ts";
import type { BottleItem } from "@/shared/bottles.ts";
import { formatCompactBottleCount } from "@/shared/bottles.ts";

type BottleManageListProps = {
  items: readonly BottleItem[];
};

/** 管理一覧。1 行 = 1 本。同名銘柄は統合しない */
export function BottleManageList({ items }: BottleManageListProps) {
  return (
    <ul className="bottle-manage-list">
      {items.map((item) => (
        <li key={item.id}>
          <BottleManageRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function BottleManageRow({ item }: { item: BottleItem }) {
  const visual = bottleTileVisual(item.thumbPhotoId, item.thumbPhotoKind);
  const vintage = vintageLabel(item.vintage);
  const meta = [vintage, item.origin, formatCompactBottleCount(1)].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <Link className="bottle-manage-row" to={`/cellar/${item.id}`}>
      <span className="bottle-manage-thumb">
        {visual === "silhouette" || !item.thumbPhotoId ? (
          <BottleSilhouette className="bottle-tile-silhouette" drinkType={item.drinkType} />
        ) : (
          <ContentPhoto
            className={
              visual === "cutout" ? "bottle-tile-img is-cutout" : "bottle-tile-img is-photo"
            }
            src={photoContentUrl(item.thumbPhotoId, "thumb")}
            size={PHOTO_DISPLAY_SIZE.bottleTile}
            loading="lazy"
          />
        )}
      </span>
      <span className="bottle-manage-copy">
        <span className="bottle-manage-name">{item.name}</span>
        <span className="bottle-manage-meta">{meta.join(" ・ ")}</span>
      </span>
    </Link>
  );
}
