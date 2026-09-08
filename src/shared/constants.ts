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

/** 画面表示名（spec/screen-designs/03-log.md N3 のチップ順 = DRINK_TYPES の順） */
export const DRINK_TYPE_LABELS: Record<DrinkType, string> = {
  wine: "ワイン",
  beer: "ビール",
  whisky: "ウイスキー",
  sake: "日本酒",
  shochu: "焼酎",
  cocktail: "カクテル",
  other: "その他",
};

/** sealed = 未開栓（棚） / consumed = 開栓（貯蔵庫） */
export const BOTTLE_STATUSES = ["sealed", "consumed"] as const;

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
/** ラベル読み取りの日次上限（ユーザー / JST 日）。api-design 4.5.3 */
export const AI_RECOGNIZE_DAILY_LIMIT = 30;
export const AI_RECOGNIZE_TIMEOUT_MS = 20_000;
/** クライアントが候補を捨てる確度の下限（サーバーは 0〜1 をそのまま返す） */
export const AI_RECOGNIZE_MIN_CONFIDENCE = 0.5;
/** Workers AI の Vision 対応・指示追従モデル（公式一覧。導入時点） */
export const WORKERS_AI_VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const LABEL_RECOGNIZE_PROVIDERS = ["workers-ai", "gemini", "openai"] as const;
export type LabelRecognizeProvider = (typeof LABEL_RECOGNIZE_PROVIDERS)[number];
export const DEFAULT_LABEL_RECOGNIZE_PROVIDER: LabelRecognizeProvider = "workers-ai";

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
export const PHOTO_MASCOT_STROKE = "#2B261F";
export const PHOTO_MASCOT_POSES = ["default", "surprised", "rest", "cheer"] as const;
export type PhotoMascotPose = (typeof PHOTO_MASCOT_POSES)[number];

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

/** ボトル下端とキャンバス下端の隙間（落ち影用。4-06） */
export const PHOTO_CUTOUT_BOTTOM_RATIO = 0.04;
export const PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS = 20_000;
export const PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS = 120_000;
export const PHOTO_CUTOUT_MODEL_SIZE = 320;
/** 同一オリジン。ビルド時に public/models へ配置する */
export const PHOTO_CUTOUT_MODEL_URL = "/models/u2netp.onnx";
/** rembg v0.0.0 の u2netp.onnx。差し替えるときはハッシュも更新する */
export const PHOTO_CUTOUT_MODEL_BYTES = 4_574_861;
export const PHOTO_CUTOUT_MODEL_SHA256 =
  "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8";
export const PHOTO_CUTOUT_CACHE = "alco-cutout-v1";
export const PHOTO_CUTOUT_ORT_WASM_PATH = "/models/ort/";
export const PHOTO_CUTOUT_ORT_WASM_FILE = "ort-wasm-simd-threaded.wasm";
export const PHOTO_CUTOUT_ORT_MJS_FILE = "ort-wasm-simd-threaded.mjs";
/** 直近の切り抜き診断。画像・Cookie・トークンは書かない */
export const PHOTO_CUTOUT_DIAG_KEY = "photo.cutout.diag";
export const PHOTO_CUTOUT_MEAN = [0.485, 0.456, 0.406] as const;
export const PHOTO_CUTOUT_STD = [0.229, 0.224, 0.225] as const;
/**
 * マスク後処理と品質判定（Issue #48 B-1〜B-3）。値は 0..255 の alpha か比率。
 * 初期値は人工マスクと手元の判定で決めたもの。実機の評価セットで誤判定を記録してから調整する。
 * 透明瓶・暗色瓶を一律に落とさないよう、判定は「全面 foreground」「両側の端まで foreground」だけに絞る。
 */
export const PHOTO_CUTOUT_MASK = {
  /** これ以下の alpha は背景残りとみなして 0 にする */
  lowAlpha: 40,
  /** これ以上の alpha は被写体とみなして 255 にする */
  highAlpha: 216,
  /** foreground 全体に対してこの比率未満の連結成分（ゴミ）は消す。最大成分は常に残す */
  minComponentRatio: 0.02,
  /** foreground 比率がこれ未満なら被写体なし */
  minForegroundRatio: 0.01,
  /** foreground 比率がこれ以上なら背景がほぼ残っている（切り抜きになっていない） */
  maxForegroundRatio: 0.85,
  /** 左右両端の接触率が両方これ以上なら背景を被写体と誤認している */
  maxSideContact: 0.6,
  /** 外接矩形・foreground 判定に使う alpha 閾値 */
  subjectAlpha: 128,
  /** 切り抜き配置の外接矩形を取る alpha 閾値（縮尺後のにじみを除く） */
  bboxAlpha: 32,
} as const;
/** 同じ画像・同じ切り抜き条件のマスクを再利用する件数（1 件 ≒ 100KB） */
export const PHOTO_CUTOUT_MASK_CACHE_SIZE = 4;

/** 設定・photo-edit が共有する localStorage キー（spec/screen-designs/07-photo-capture.md） */
export const PHOTO_PREF_KEYS = {
  mascot: "photo.mascot",
  filter: "photo.filter",
  cutout: "photo.cutout",
  recognize: "cellar.recognize",
} as const;

/** 棚の表示切替（04-cellar C4）。API の `view=cellar|archive|all` とは別 */
/** 画面上の並びは種類ごと → 1 本ずつ（spec/screen-designs/04-cellar.md bottle-list） */
export const CELLAR_LIST_VIEWS = ["type", "one"] as const;

export type CellarListView = (typeof CELLAR_LIST_VIEWS)[number];

export const DEFAULT_CELLAR_LIST_VIEW: CellarListView = "one";

export const CELLAR_PREF_KEYS = {
  listView: "cellar.listView",
} as const;

/** 操作設定の localStorage キー（spec/screen-designs/06-settings.md S8 / S9、motion-design 6.5 / 6.7） */
export const UI_PREF_KEYS = {
  haptic: "ui.haptic",
  reduceMotion: "ui.reduce-motion",
  theme: "ui.theme",
} as const;

/** 初回ガイド（spec/features/first-run-guide.md）。値は userId 付き JSON */
export const GUIDE_PREF_KEY = "guide.first-run";

export const GUIDE_STATUSES = ["unset", "skipped", "completed", "existing"] as const;

export type GuideStatus = (typeof GUIDE_STATUSES)[number];

/** キャラの短い動き（character.md 6 章）。CSS トークンと揃える */
export const MASCOT_LIFE_MS = {
  blink: 150,
  gaze: 240,
  wink: 380,
  react: 400,
  idleBlinkMin: 15_000,
  idleBlinkMax: 30_000,
  tapCooldown: 1_200,
} as const;

export const REDUCE_MOTION_PREFS = ["system", "always"] as const;

export type ReduceMotionPref = (typeof REDUCE_MOTION_PREFS)[number];

/** 外観（06-settings S10）。`system` = 端末の外観設定に従う（既定）/ `light` / `dark` */
export const THEME_PREFS = ["system", "light", "dark"] as const;

export type ThemePref = (typeof THEME_PREFS)[number];

/** `<html data-theme>` に入る解決済みテーマ */
export type ResolvedTheme = Exclude<ThemePref, "system">;
