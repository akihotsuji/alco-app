import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.ts";

export function createD1Db(database: D1Database) {
  return drizzle(database, { schema });
}

export type AppDb = ReturnType<typeof createD1Db>;

/** D1 / libsql のどちらでも photos サービスを動かすための共通型 */
export type AppSqliteDb = BaseSQLiteDatabase<"async", unknown, typeof schema>;
