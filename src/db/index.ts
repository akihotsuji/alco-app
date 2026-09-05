import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

export function createD1Db(database: D1Database) {
  return drizzle(database, { schema });
}

export type AppDb = ReturnType<typeof createD1Db>;
