import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  BOTTLE_STATUSES,
  DEFAULT_BOTTLE_STATUS,
  DEFAULT_PHOTO_KIND,
  DRINK_TYPES,
  PHOTO_KINDS,
} from "../shared/constants.ts";
import { user } from "./auth-schema.ts";

export * from "./auth-schema.ts";

// CHECK は enum と写真の排他だけに絞る。範囲・文字数は Zod を正とする（spec/data-model.md 2-8）
// drizzle-kit は CHECK 内のバインド値を `?` のまま出力するため、定数リテラルを直接埋め込む。
// 値はコード定数のみ（ユーザー入力ではない）。クォートを含まないことを実行時にも保証する
const inList = (values: readonly string[]) => {
  for (const v of values) {
    if (!/^[a-z_]+$/.test(v)) {
      throw new Error(`enum 値は小文字英字と _ のみ: ${v}`);
    }
  }
  return sql.raw(values.map((v) => `'${v}'`).join(", "));
};

const drinkTypeCheck = (tableName: string) =>
  check(`${tableName}_drink_type_check`, sql`drink_type IN (${inList(DRINK_TYPES)})`);

const userIdColumn = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

const timestampColumns = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const myDrinks = sqliteTable(
  "my_drinks",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    name: text("name").notNull(),
    drinkType: text("drink_type", { enum: DRINK_TYPES }).notNull(),
    volumeMl: integer("volume_ml").notNull(),
    abvPercent: real("abv_percent").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestampColumns,
  },
  (table) => [
    index("my_drinks_user_sort_idx").on(table.userId, table.sortOrder),
    drinkTypeCheck("my_drinks"),
  ],
);

// 1 行 = 1 本（1-07）。本数 N は API が N 行に展開するため quantity 列は持たない
export const bottles = sqliteTable(
  "bottles",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    name: text("name").notNull(),
    drinkType: text("drink_type", { enum: DRINK_TYPES }).notNull(),
    producer: text("producer"),
    origin: text("origin"),
    vintage: integer("vintage"),
    purchasedOn: text("purchased_on"),
    priceJpy: integer("price_jpy"),
    shop: text("shop"),
    storage: text("storage"),
    memo: text("memo"),
    status: text("status", { enum: BOTTLE_STATUSES }).notNull().default(DEFAULT_BOTTLE_STATUS),
    openedOn: text("opened_on"),
    // consumed のとき必須、それ以外 NULL。consumed_on は consumed_at から JST でサーバー算出
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    consumedOn: text("consumed_on"),
    ...timestampColumns,
  },
  (table) => [
    index("bottles_user_status_idx").on(table.userId, table.status),
    index("bottles_user_type_idx").on(table.userId, table.drinkType),
    index("bottles_user_consumed_idx").on(table.userId, table.consumedAt),
    drinkTypeCheck("bottles"),
    check("bottles_status_check", sql`status IN (${inList(BOTTLE_STATUSES)})`),
  ],
);

export const drinkLogs = sqliteTable(
  "drink_logs",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    drunkAt: integer("drunk_at", { mode: "timestamp_ms" }).notNull(),
    // Asia/Tokyo のカレンダー日 (YYYY-MM-DD)。drunk_at からサーバーが算出する
    drunkOn: text("drunk_on").notNull(),
    drinkType: text("drink_type", { enum: DRINK_TYPES }).notNull(),
    drinkName: text("drink_name"),
    volumeMl: integer("volume_ml").notNull(),
    abvPercent: real("abv_percent").notNull(),
    // サーバー再計算値。クライアントの値は採用しない
    alcoholG: real("alcohol_g").notNull(),
    memo: text("memo"),
    myDrinkId: text("my_drink_id").references(() => myDrinks.id, { onDelete: "set null" }),
    bottleId: text("bottle_id").references(() => bottles.id, { onDelete: "set null" }),
    ...timestampColumns,
  },
  (table) => [
    index("drink_logs_user_drunk_on_idx").on(table.userId, table.drunkOn),
    index("drink_logs_user_drunk_at_idx").on(table.userId, table.drunkAt),
    index("drink_logs_my_drink_id_idx").on(table.myDrinkId),
    index("drink_logs_user_bottle_idx").on(table.userId, table.bottleId),
    drinkTypeCheck("drink_logs"),
  ],
);

export const tastingNotes = sqliteTable(
  "tasting_notes",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    bottleId: text("bottle_id").references(() => bottles.id, { onDelete: "set null" }),
    // ボトル改名後も当時の値を残すためのスナップショット
    drinkName: text("drink_name").notNull(),
    drinkType: text("drink_type", { enum: DRINK_TYPES }).notNull(),
    tastedOn: text("tasted_on").notNull(),
    appearance: text("appearance"),
    aroma: text("aroma"),
    taste: text("taste"),
    finish: text("finish"),
    // 1.0〜5.0 の 0.5 刻みを 10〜50 の整数で保存する（float 比較を避ける）
    ratingX10: integer("rating_x10").notNull(),
    ...timestampColumns,
  },
  (table) => [
    index("tasting_notes_user_tasted_on_idx").on(table.userId, table.tastedOn),
    index("tasting_notes_user_bottle_idx").on(table.userId, table.bottleId),
    drinkTypeCheck("tasting_notes"),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    // サーバー生成キー。ユーザーのファイル名や user_id を含めない
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    bottleId: text("bottle_id").references(() => bottles.id, { onDelete: "cascade" }),
    tastingNoteId: text("tasting_note_id").references(() => tastingNotes.id, {
      onDelete: "cascade",
    }),
    drinkLogId: text("drink_log_id").references(() => drinkLogs.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PHOTO_KINDS }).notNull().default(DEFAULT_PHOTO_KIND),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("photos_r2_key_uidx").on(table.r2Key),
    index("photos_user_created_idx").on(table.userId, table.createdAt),
    index("photos_bottle_sort_idx").on(table.bottleId, table.sortOrder),
    index("photos_note_sort_idx").on(table.tastingNoteId, table.sortOrder),
    index("photos_log_idx").on(table.drinkLogId),
    // 所有者 3 列は最大 1 つ。すべて NULL（未紐付け）は許可
    check(
      "photos_owner_check",
      sql`(bottle_id IS NOT NULL) + (tasting_note_id IS NOT NULL) + (drink_log_id IS NOT NULL) <= 1`,
    ),
    check("photos_kind_check", sql`kind IN (${inList(PHOTO_KINDS)})`),
  ],
);

// ラベル読み取り（Workers AI）の日次利用回数。画像・結果は保存しない
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: userIdColumn(),
    usedOn: text("used_on").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usedOn] })],
);
