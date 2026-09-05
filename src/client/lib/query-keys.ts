/**
 * TanStack Query の queryKey はここに集める。
 * 先頭がリソース名、以降が絞り込み条件の配列（例: `["drink-logs", { from, to }]`）。
 * mutation 成功後は同じリソース名の先頭要素で `invalidateQueries` する。
 */
export const queryKeys = {
  me: ["me"] as const,
} as const;
