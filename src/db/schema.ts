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
import { PHOTO_TASK_STATUSES } from "../shared/account-deletion.ts";
import {
  BOTTLE_STATUSES,
  CELLAR_ACTIVITY_ACTIONS,
  CELLAR_KINDS,
  CELLAR_TRANSFER_STATUSES,
  DEFAULT_BOTTLE_STATUS,
  DEFAULT_PHOTO_KIND,
  DRINK_TYPES,
  PHOTO_KINDS,
} from "../shared/constants.ts";
import { FEEDBACK_CATEGORIES } from "../shared/feedback.ts";
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

// 列ビルダーはテーブル登録時に config を in-place で書き換える。共有すると uniqueName や
// 後続の relational / 絞り込みクエリが別テーブルの created_at / updated_at を指す
const userIdColumn = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

const timestampColumns = () => ({
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const cellars = sqliteTable(
  "cellars",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: CELLAR_KINDS }).notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    ...timestampColumns(),
  },
  (table) => [
    index("cellars_owner_idx").on(table.ownerUserId),
    uniqueIndex("cellars_personal_owner_uidx")
      .on(table.ownerUserId)
      .where(sql`${table.kind} = 'personal'`),
    check("cellars_kind_check", sql`kind IN (${inList(CELLAR_KINDS)})`),
  ],
);

export const userCellarSlots = sqliteTable(
  "user_cellar_slots",
  {
    userId: text("user_id")
      .primaryKey()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personalCellarId: text("personal_cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    sharedCellarId: text("shared_cellar_id").references(() => cellars.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("user_cellar_slots_personal_uidx").on(table.personalCellarId)],
);

export const cellarMembers = sqliteTable(
  "cellar_members",
  {
    id: text("id").primaryKey(),
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    userId: userIdColumn(),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("cellar_members_cellar_user_uidx").on(table.cellarId, table.userId),
    index("cellar_members_user_idx").on(table.userId),
  ],
);

export const cellarInvitations = sqliteTable(
  "cellar_invitations",
  {
    id: text("id").primaryKey(),
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("cellar_invitations_token_hash_uidx").on(table.tokenHash),
    index("cellar_invitations_cellar_idx").on(table.cellarId, table.expiresAt),
  ],
);

export const cellarOwnerTransfers = sqliteTable(
  "cellar_owner_transfers",
  {
    id: text("id").primaryKey(),
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id").references(() => user.id, { onDelete: "set null" }),
    toUserId: text("to_user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: CELLAR_TRANSFER_STATUSES }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("cellar_transfers_pending_uidx")
      .on(table.cellarId)
      .where(sql`${table.status} = 'pending'`),
    index("cellar_transfers_to_idx").on(table.toUserId, table.status),
    check("cellar_transfers_status_check", sql`status IN (${inList(CELLAR_TRANSFER_STATUSES)})`),
  ],
);

export const cellarActivity = sqliteTable(
  "cellar_activity",
  {
    id: text("id").primaryKey(),
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: CELLAR_ACTIVITY_ACTIONS }).notNull(),
    bottleId: text("bottle_id"),
    bottleName: text("bottle_name"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("cellar_activity_cellar_created_idx").on(table.cellarId, table.createdAt),
    check("cellar_activity_action_check", sql`action IN (${inList(CELLAR_ACTIVITY_ACTIONS)})`),
  ],
);

export const cellarIdempotency = sqliteTable(
  "cellar_idempotency",
  {
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    operationKey: text("operation_key").notNull(),
    requestHash: text("request_hash").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.actorUserId, table.cellarId, table.operationKey] }),
    index("cellar_idempotency_created_idx").on(table.createdAt),
  ],
);

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
    ...timestampColumns(),
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
    cellarId: text("cellar_id")
      .notNull()
      .references(() => cellars.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    drinkType: text("drink_type", { enum: DRINK_TYPES }).notNull(),
    producer: text("producer"),
    origin: text("origin"),
    variety: text("variety"),
    vintage: integer("vintage"),
    purchasedOn: text("purchased_on"),
    priceJpy: integer("price_jpy"),
    shop: text("shop"),
    storedOn: text("stored_on"),
    storage: text("storage"),
    memo: text("memo"),
    status: text("status", { enum: BOTTLE_STATUSES }).notNull().default(DEFAULT_BOTTLE_STATUS),
    // 小さいほど先。意味があるのは sealed。範囲は (cellar_id, drink_type)
    sortOrder: integer("sort_order").notNull().default(0),
    // consumed のとき必須、それ以外 NULL。consumed_on は consumed_at から JST でサーバー算出
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    consumedOn: text("consumed_on"),
    ...timestampColumns(),
  },
  (table) => [
    index("bottles_cellar_status_idx").on(table.cellarId, table.status),
    index("bottles_cellar_type_idx").on(table.cellarId, table.drinkType),
    index("bottles_cellar_consumed_idx").on(table.cellarId, table.consumedAt),
    index("bottles_cellar_type_sort_idx").on(
      table.cellarId,
      table.drinkType,
      table.status,
      table.sortOrder,
    ),
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
    producer: text("producer"),
    origin: text("origin"),
    variety: text("variety"),
    vintage: integer("vintage"),
    volumeMl: integer("volume_ml").notNull(),
    abvPercent: real("abv_percent").notNull(),
    // サーバー再計算値。クライアントの値は採用しない
    alcoholG: real("alcohol_g").notNull(),
    memo: text("memo"),
    placeName: text("place_name"),
    placeLat: real("place_lat"),
    placeLng: real("place_lng"),
    myDrinkId: text("my_drink_id").references(() => myDrinks.id, { onDelete: "set null" }),
    bottleId: text("bottle_id").references(() => bottles.id, { onDelete: "set null" }),
    ...timestampColumns(),
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
    vintage: integer("vintage"),
    producer: text("producer"),
    origin: text("origin"),
    variety: text("variety"),
    tastedOn: text("tasted_on").notNull(),
    appearance: text("appearance"),
    aroma: text("aroma"),
    taste: text("taste"),
    finish: text("finish"),
    // 1.0〜5.0 の 0.5 刻みを 10〜50 の整数で保存する（float 比較を避ける）
    ratingX10: integer("rating_x10").notNull(),
    ...timestampColumns(),
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
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    cellarId: text("cellar_id").references(() => cellars.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
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
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("photos_r2_key_uidx").on(table.r2Key),
    index("photos_user_created_idx").on(table.userId, table.createdAt),
    index("photos_cellar_created_idx").on(table.cellarId, table.createdAt),
    index("photos_uploaded_created_idx").on(table.uploadedBy, table.createdAt),
    index("photos_bottle_sort_idx").on(table.bottleId, table.sortOrder),
    index("photos_note_sort_idx").on(table.tastingNoteId, table.sortOrder),
    index("photos_log_idx").on(table.drinkLogId),
    // 所有者 3 列は最大 1 つ。すべて NULL（未紐付け）は許可
    check(
      "photos_owner_check",
      sql`(bottle_id IS NOT NULL) + (tasting_note_id IS NOT NULL) + (drink_log_id IS NOT NULL) <= 1`,
    ),
    check(
      "photos_scope_check",
      sql`(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN cellar_id IS NOT NULL THEN 1 ELSE 0 END) = 1`,
    ),
    check(
      "photos_bottle_scope_check",
      sql`bottle_id IS NULL OR (cellar_id IS NOT NULL AND user_id IS NULL)`,
    ),
    check(
      "photos_personal_owner_check",
      sql`(tasting_note_id IS NULL AND drink_log_id IS NULL) OR (user_id IS NOT NULL AND cellar_id IS NULL)`,
    ),
    check("photos_kind_check", sql`kind IN (${inList(PHOTO_KINDS)})`),
  ],
);

// 認識 API の日次利用回数。画像・結果は保存しない
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: userIdColumn(),
    usedOn: text("used_on").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usedOn] })],
);

// サインアップ時の規約・PP 同意（8-01）。Better Auth の user は触らない
export const legalConsents = sqliteTable(
  "legal_consents",
  {
    id: text("id").primaryKey(),
    userId: userIdColumn(),
    documentVersion: text("document_version").notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex("legal_consents_user_uidx").on(table.userId)],
);

// 満 20 歳の確認（8-02）。成功時だけ 1 行。Better Auth の user は触らない
export const ageVerifications = sqliteTable("age_verifications", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  birthOn: text("birth_on").notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull(),
  ...timestampColumns(),
});

/** R2 put 前の予約。user CASCADE は付けない（削除と遅延 put の競合） */
export const photoObjectReservations = sqliteTable(
  "photo_object_reservations",
  {
    r2Key: text("r2_key").primaryKey(),
    userId: text("user_id").notNull(),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("photo_object_reservations_user_lease_idx").on(table.userId, table.leaseUntil)],
);

export const accountDeletionRequests = sqliteTable("account_deletion_requests", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const accountDeletionRecords = sqliteTable("account_deletion_records", {
  userId: text("user_id").primaryKey(),
  requestId: text("request_id").notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }).notNull(),
  replicatedAt: integer("replicated_at", { mode: "timestamp_ms" }),
});

/** ご意見。退会後は user_id を外して本文と画像を残す */
export const feedbacks = sqliteTable(
  "feedbacks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    category: text("category", { enum: FEEDBACK_CATEGORIES }).notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("feedbacks_user_created_idx").on(table.userId, table.createdAt),
    check("feedbacks_category_check", sql`category IN (${inList(FEEDBACK_CATEGORIES)})`),
  ],
);

/** photos とは別。退会時の R2 回収に載せない */
export const feedbackPhotos = sqliteTable(
  "feedback_photos",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedbacks.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("feedback_photos_r2_key_uidx").on(table.r2Key),
    index("feedback_photos_feedback_idx").on(table.feedbackId),
  ],
);

export const accountDeletionPhotoTasks = sqliteTable(
  "account_deletion_photo_tasks",
  {
    r2Key: text("r2_key").primaryKey(),
    requestId: text("request_id").notNull(),
    status: text("status", { enum: PHOTO_TASK_STATUSES }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }).notNull(),
    leaseUntil: integer("lease_until", { mode: "timestamp_ms" }),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("account_deletion_photo_tasks_due_idx").on(table.status, table.nextAttemptAt),
    check(
      "account_deletion_photo_tasks_status_check",
      sql`status IN (${inList(PHOTO_TASK_STATUSES)})`,
    ),
  ],
);
