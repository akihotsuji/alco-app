import { type PointerEvent as ReactPointerEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
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

export type BottleTileFaceProps = {
  item: BottleItem;
  mode: BottleTileMode;
  size?: BottleTileSize;
  readySrc?: string | null;
  photoLoading?: "lazy" | "eager";
  showPressShield?: boolean;
};

export function BottleTileFace({
  item,
  mode,
  size = "one",
  readySrc,
  photoLoading = "lazy",
  showPressShield,
}: BottleTileFaceProps) {
  const visual = bottleTileVisual(item.thumbPhotoId, item.thumbPhotoKind);
  const showSub = mode === "cellar" && size === "one";
  const vintage = vintageLabel(item.vintage);
  const [photoState, setPhotoState] = useState<ContentPhotoState>(readySrc ? "loaded" : "loading");

  return (
    <>
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
              loading={photoLoading}
              readySrc={readySrc}
              onStateChange={setPhotoState}
            />
          </>
        )}
        {mode === "archived" && item.consumedOn ? (
          <span className="bottle-tile-date">{formatShortMonthDay(item.consumedOn)}</span>
        ) : null}
        {showPressShield ? <span className="bottle-tile-press-shield" aria-hidden /> : null}
      </span>
      <span className="bottle-tile-name">{item.name}</span>
      {showSub && vintage ? <span className="bottle-tile-sub">{vintage}</span> : null}
    </>
  );
}

type BottleTileProps = {
  item: BottleItem;
  mode: BottleTileMode;
  size?: BottleTileSize;
  enter?: boolean;
  preventNavigate?: boolean;
  /**
   * 種類グリッドなど、長押しをアプリが取る面では `a`/`img` のネイティブメニューを出さない。
   * 短いタップは `navigate` で詳細へ。
   */
  suppressNativePress?: boolean;
  /** 並べ替え可能なタイルだけ touch-action: none。検索中は付けない */
  lockTouchAction?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onActivate?: () => void;
};

export function BottleTile({
  item,
  mode,
  size = "one",
  enter,
  preventNavigate,
  suppressNativePress,
  lockTouchAction = suppressNativePress,
  onPointerDown,
  onActivate,
}: BottleTileProps) {
  const navigate = useNavigate();
  const className = cn("bottle-tile", size === "type" && "is-type");
  const href = `/cellar/${item.id}`;

  function activate() {
    if (preventNavigate) {
      return;
    }
    if (onActivate) {
      onActivate();
      return;
    }
    navigate(href);
  }

  const body = (
    <BottleTileFace item={item} mode={mode} size={size} showPressShield={suppressNativePress} />
  );

  if (suppressNativePress) {
    return (
      <button
        type="button"
        className={className}
        data-enter={enter ? "1" : undefined}
        data-press-safe="1"
        data-touch-lock={lockTouchAction ? "1" : undefined}
        onClick={activate}
        onPointerDown={onPointerDown}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      className={className}
      data-enter={enter ? "1" : undefined}
      to={href}
      onClick={(event) => {
        if (preventNavigate) {
          event.preventDefault();
        }
      }}
    >
      {body}
    </Link>
  );
}
