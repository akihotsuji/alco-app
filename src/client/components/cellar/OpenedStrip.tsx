import { Link } from "react-router";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import type { BottleItem } from "@/shared/bottles.ts";

export const OPENED_STRIP_HEADING = "味わい中";

type OpenedStripProps = {
  items: readonly BottleItem[];
  /** 直前に開栓して加わった 1 本（M-39） */
  enterId?: string | null;
  className?: string;
};

/**
 * 味わい中のボトルを丸アイコンで横に並べる補助表示（bottle-tasting.md 2.1 C15 / 5.1 H14）。
 * 棚の陳列とは混ぜない。0 本なら何も出さない。写真に文字を重ねず、品名はアクセシブル名だけ
 */
export function OpenedStrip({ items, enterId = null, className }: OpenedStripProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section
      className={className ? `opened-strip ${className}` : "opened-strip"}
      aria-label={`${OPENED_STRIP_HEADING} ${items.length}本`}
    >
      <h2 className="opened-strip-heading">{OPENED_STRIP_HEADING}</h2>
      <ul className="opened-strip-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              className="opened-strip-item"
              to={`/cellar/${item.id}`}
              aria-label={item.name}
              data-enter={item.id === enterId ? "1" : undefined}
            >
              {item.thumbPhotoId ? (
                <ContentPhoto
                  className="opened-strip-img"
                  src={photoContentUrl(item.thumbPhotoId, "thumb")}
                  size={PHOTO_DISPLAY_SIZE.bottleTile}
                  loading="lazy"
                />
              ) : (
                <BottleSilhouette className="opened-strip-silhouette" drinkType={item.drinkType} />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
