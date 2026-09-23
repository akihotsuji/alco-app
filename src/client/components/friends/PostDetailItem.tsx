import { useState } from "react";
import { BottleSilhouette } from "@/client/components/cellar/BottleSilhouette.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { socialPhotoContentUrl } from "@/client/hooks/use-social.ts";
import type { SocialPostItem } from "@/shared/social.ts";
import { formatRatingX10 } from "@/shared/tasting-notes.ts";

type PostDetailItemProps = {
  postId: string;
  item: SocialPostItem;
  /** まとめ登録など複数アイテムの投稿。写真を小さくして横並びにする */
  compact: boolean;
};

/** `friends-post` の 1 アイテム。写真はボトル詳細と同じ大きさ（主 240px + 脇の小サムネ） */
export function PostDetailItem({ postId, item, compact }: PostDetailItemProps) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [tastingOpen, setTastingOpen] = useState(false);
  const [hero, ...extras] = item.photoIds;
  const meta = postItemMeta(item);
  const dates = postItemDates(item);

  const photos = compact ? (
    <button
      type="button"
      className="social-post-compact-photo"
      disabled={!hero}
      aria-label={hero ? `${item.name}の写真を拡大` : undefined}
      onClick={() => hero && setViewing(hero)}
    >
      {hero ? (
        <img src={socialPhotoContentUrl(postId, hero, "thumb")} alt="" loading="lazy" />
      ) : (
        <BottleSilhouette className="social-post-compact-silhouette" />
      )}
    </button>
  ) : hero ? (
    <div className={extras.length > 0 ? "bottle-detail-photos has-back" : "bottle-detail-photos"}>
      <button
        type="button"
        className="bottle-hero"
        aria-label={`${item.name}の写真を拡大`}
        onClick={() => setViewing(hero)}
      >
        <img
          className="bottle-hero-img is-photo"
          src={socialPhotoContentUrl(postId, hero)}
          alt=""
        />
      </button>
      {extras.length > 0 ? (
        <div className="social-post-thumbs">
          {extras.map((photoId, index) => (
            <button
              key={photoId}
              type="button"
              className="bottle-back-thumb"
              aria-label={`写真 ${index + 2} を拡大`}
              onClick={() => setViewing(photoId)}
            >
              <span className="photo-thumb bottle-back-thumb-frame">
                <img
                  className="photo-thumb-img"
                  src={socialPhotoContentUrl(postId, photoId, "thumb")}
                  alt=""
                  loading="lazy"
                />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <section className={compact ? "social-post-item is-compact" : "social-post-item"}>
      {photos}
      <div className="social-post-text">
        <h2 className="social-post-name">{item.name}</h2>
        {meta ? <p className="social-post-meta">{meta}</p> : null}
        {dates ? <p className="social-post-meta">{dates}</p> : null}
        {item.ratingX10 != null || item.comment ? (
          <p className="social-post-comment">
            {item.ratingX10 != null ? formatRatingX10(item.ratingX10) : null}
            {item.ratingX10 != null && item.comment ? " ・ " : null}
            {item.comment}
          </p>
        ) : null}
        {item.tasting ? (
          <div>
            <Button type="button" variant="ghost" onClick={() => setTastingOpen((value) => !value)}>
              詳しく見る
            </Button>
            {tastingOpen ? (
              <dl className="social-tasting">
                {item.tasting.appearance ? (
                  <>
                    <dt>外観</dt>
                    <dd>{item.tasting.appearance}</dd>
                  </>
                ) : null}
                {item.tasting.aroma ? (
                  <>
                    <dt>香り</dt>
                    <dd>{item.tasting.aroma}</dd>
                  </>
                ) : null}
                {item.tasting.taste ? (
                  <>
                    <dt>味わい</dt>
                    <dd>{item.tasting.taste}</dd>
                  </>
                ) : null}
                {item.tasting.finish ? (
                  <>
                    <dt>余韻</dt>
                    <dd>{item.tasting.finish}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
      <PhotoViewer
        open={viewing !== null}
        src={viewing ? socialPhotoContentUrl(postId, viewing) : ""}
        alt={item.name}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}

/** 生産者・国・品種・年を 1 行にまとめる（縦に積んでスクロールさせない） */
export function postItemMeta(item: SocialPostItem): string {
  return [item.producer, item.origin, item.variety, item.vintage ? String(item.vintage) : null]
    .filter((value): value is string => Boolean(value))
    .join(" ・ ");
}

export function postItemDates(item: SocialPostItem): string {
  return [
    item.openedOn ? `開栓した日 ${item.openedOn}` : null,
    item.drunkOn ? `飲んだ日 ${item.drunkOn}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ・ ");
}
