import { type SyntheticEvent, useLayoutEffect, useRef, useState } from "react";

/**
 * ユーザー写真の表示寸法（CSS と一致。Lighthouse の画像アスペクト用）。
 * 表示サイズは CSS が決める。ここは intrinsic の比だけ固定する。
 */
export const PHOTO_DISPLAY_SIZE = {
  logRow: { width: 48, height: 48 },
  logTile: { width: 96, height: 120 },
  bottleTile: { width: 100, height: 150 },
  bottlePicker: { width: 40, height: 60 },
  bottleHero: { width: 160, height: 240 },
  bottleHeroPhoto: { width: 160, height: 300 },
  noteCard: { width: 160, height: 200 },
} as const;

type PhotoDisplaySize = (typeof PHOTO_DISPLAY_SIZE)[keyof typeof PHOTO_DISPLAY_SIZE];

/** 写真の到着状態。`loading` の間は不透明 0 で、背後のプレースホルダが見える（00-common 2.5 / M-29） */
export type ContentPhotoState = "loading" | "loaded";

type ContentPhotoProps = {
  src: string;
  size: PhotoDisplaySize;
  className?: string;
  /** 一覧は lazy。LCP・編集中プレビュー・ライトボックスは eager */
  loading?: "lazy" | "eager";
  alt?: string;
  /** 到着した瞬間に親がプレースホルダを消すために使う */
  onStateChange?: (state: ContentPhotoState) => void;
  /** 既に表示済みの同じ src。追従レイヤーへ渡して loading フラッシュを防ぐ */
  readySrc?: string | null;
};

/** ブラウザキャッシュ済みの写真は `load` イベントより先に描かれていることがある */
export function isImageSettled(img: { complete: boolean; naturalWidth: number }): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function ContentPhoto({
  src,
  size,
  className,
  loading = "lazy",
  alt = "",
  onStateChange,
  readySrc,
}: ContentPhotoProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [settledSrc, setSettledSrc] = useState<string | null>(() =>
    readySrc === src ? src : null,
  );
  const state: ContentPhotoState = settledSrc === src ? "loaded" : "loading";

  useLayoutEffect(() => {
    const img = ref.current;
    if (img && isImageSettled(img) && img.currentSrc.length > 0) {
      setSettledSrc(src);
    }
  }, [src]);

  useLayoutEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // 失敗しても透明のまま残さない（壊れた画像は alt かブラウザの既定表示に任せる）
  function settle(event: SyntheticEvent<HTMLImageElement>) {
    setSettledSrc(event.currentTarget.getAttribute("src"));
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      width={size.width}
      height={size.height}
      loading={loading}
      decoding="async"
      draggable={false}
      data-state={state}
      onLoad={settle}
      onError={settle}
    />
  );
}
