import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.ts";

export function createD1Db(database: D1Database) {
  return drizzle(database, { schema });
}

export type AppDb = ReturnType<typeof createD1Db>;

/** D1 / libsql のどちらでも photos サービスを動かすための共通型 */
export type AppSqliteDb = BaseSQLiteDatabase<"async", unknown, typeof schema>;

/**
 * 複数文をまとめて実行できる DB。D1 は `BEGIN` を受け付けないため、
 * 「作成 + 写真の紐付け」のような同一トランザクションは `batch` で行う（D1 / libsql 双方が持つ）。
 */
export type AppBatchDb = AppSqliteDb & Pick<AppDb, "batch">;
