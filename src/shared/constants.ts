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
