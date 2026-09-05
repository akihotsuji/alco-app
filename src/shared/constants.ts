/**
 * クライアント/サーバー/DB で共有する列挙値。
 * 正本は spec/data-model.md 5.3 / 5.4 / 6.5。DB の CHECK 制約（src/db/schema.ts）と Zod enum はこの配列から作る。
 */

export const DRINK_TYPES = [
  "wine",
  "beer",
  "whisky",
  "sake",
  "shochu",
  "cocktail",
  "other",
] as const;

export type DrinkType = (typeof DRINK_TYPES)[number];

/** sealed = 未開栓（棚） / opened = 開栓済み（棚） / consumed = 消費（貯蔵庫） */
export const BOTTLE_STATUSES = ["sealed", "opened", "consumed"] as const;

export type BottleStatus = (typeof BOTTLE_STATUSES)[number];

export const DEFAULT_BOTTLE_STATUS: BottleStatus = "sealed";

/** photo = 長方形 JPEG / cutout = 背景除去済み透過 WebP（セラーのみ） */
export const PHOTO_KINDS = ["photo", "cutout"] as const;

export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const DEFAULT_PHOTO_KIND: PhotoKind = "photo";

/** 設定画面のバージョン表記。ビルド時定数（spec/screen-designs/06-settings.md S7） */
export const APP_VERSION = "0.1.0";

/** サーバーが受け付ける画像 MIME。クライアント申告は信用せず magic bytes で決める */
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

export const PHOTO_MAX_BYTES = 1_048_576;
export const PHOTO_MAX_LONG_EDGE = 1600;
export const PHOTO_OUTPUT_LONG_EDGE = 1280;
export const PHOTO_JPEG_QUALITY = 0.82;
export const PHOTO_WEBP_QUALITY = 0.9;
export const PHOTO_GC_TTL_MS = 24 * 60 * 60 * 1000;
export const PHOTO_GC_BATCH_SIZE = 500;
export const AI_USAGE_RETENTION_DAYS = 30;

export const PHOTO_OWNER_LIMITS = {
  bottle: 1,
  tastingNote: 6,
  drinkLog: 1,
} as const;

export const PHOTO_ASPECT = {
  log: { width: 4, height: 5 },
  note: { width: 4, height: 5 },
  cellar: { width: 2, height: 3 },
} as const;

export const PHOTO_SCALE_MIN = 1;
export const PHOTO_SCALE_MAX = 3;
export const PHOTO_MASCOT_SHORT_SIDE_RATIO = 0.22;
export const PHOTO_MASCOT_MARGIN_RATIO = 0.04;
export const PHOTO_MASCOT_ASPECT = { width: 3, height: 4 } as const;
export const PHOTO_MASCOT_GLOW_RADIUS_RATIO = 0.6;
export const PHOTO_MASCOT_STROKE = "#2B261F";
export const PHOTO_MASCOT_GLOW = "rgba(255, 255, 255, 0.6)";

export const PHOTO_DECODE_MAX_EDGE = 2560;

export const PHOTO_FILTERS = {
  table: "saturate(1.08) contrast(1.04)",
  cellar: "saturate(1.05) contrast(1.06) brightness(0.97) sepia(0.10)",
} as const;

export const PHOTO_CELLAR_VIGNETTE = {
  radius: 0.75,
  opacity: 0.25,
} as const;

export const PHOTO_CUTOUT_SHADOW = {
  widthRatio: 0.8,
  heightPx: 6,
  color: "rgba(0, 0, 0, 0.25)",
} as const;

/** 設定・photo-edit が共有する localStorage キー（spec/screen-designs/07-photo-capture.md） */
export const PHOTO_PREF_KEYS = {
  mascot: "photo.mascot",
  filter: "photo.filter",
  cutout: "photo.cutout",
  recognize: "cellar.recognize",
} as const;
