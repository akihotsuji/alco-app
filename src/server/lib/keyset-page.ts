import type { AnyColumn } from "drizzle-orm";
import { type SQL, sql } from "drizzle-orm";

/** limit+1 件からページと続き有無を切る */
export function takeLimitPlusOne<T>(
  rows: readonly T[],
  limit: number,
): {
  page: T[];
  hasMore: boolean;
} {
  const hasMore = rows.length > limit;
  return {
    page: hasMore ? rows.slice(0, limit) : [...rows],
    hasMore,
  };
}

/** DESC (sort, id) の keyset。sort は integer / text どちらでも可 */
export function keysetAfterDesc(
  sortColumn: AnyColumn,
  idColumn: AnyColumn,
  sortValue: number | string,
  id: string,
): SQL {
  return sql`(${sortColumn} < ${sortValue} or (${sortColumn} = ${sortValue} and ${idColumn} < ${id}))`;
}

/** ASC (sort, id) の keyset */
export function keysetAfterAsc(
  sortColumn: AnyColumn,
  idColumn: AnyColumn,
  sortValue: number | string,
  id: string,
): SQL {
  return sql`(${sortColumn} > ${sortValue} or (${sortColumn} = ${sortValue} and ${idColumn} > ${id}))`;
}
