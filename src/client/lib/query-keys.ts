/**
 * TanStack Query の queryKey はここに集める。
 * 先頭がリソース名、以降が絞り込み条件の配列（例: `["drink-logs", { from, to }]`）。
 * mutation 成功後は同じリソース名の先頭要素で `invalidateQueries` する。
 */
export const queryKeys = {
  me: ["me"] as const,
  photos: ["photos"] as const,
  drinkLogs: ["drink-logs"] as const,
  drinkLogsDay: (date: string) => ["drink-logs", { date }] as const,
  drinkLog: (id: string) => ["drink-logs", id] as const,
  drinkLogSummaries: ["drink-log-summaries"] as const,
  drinkLogSummary: (period: "day" | "week" | "month", date: string) =>
    ["drink-log-summaries", { period, date }] as const,
  myDrinks: ["my-drinks"] as const,
  myDrink: (id: string) => ["my-drinks", id] as const,
} as const;
