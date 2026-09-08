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

type ContentPhotoProps = {
  src: string;
  size: PhotoDisplaySize;
  className?: string;
  /** 一覧は lazy。LCP・編集中プレビュー・ライトボックスは eager */
  loading?: "lazy" | "eager";
  alt?: string;
};

export function ContentPhoto({
  src,
  size,
  className,
  loading = "lazy",
  alt = "",
}: ContentPhotoProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={size.width}
      height={size.height}
      loading={loading}
      decoding="async"
    />
  );
}
