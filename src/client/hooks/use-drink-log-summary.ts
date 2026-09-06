import { useQuery } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";

export type SummaryPeriod = "day" | "week" | "month";

export function getDrinkLogSummary(period: SummaryPeriod, date: string, client: ApiClient = api) {
  return unwrap(
    client.api["drink-logs"].summary.$get({
      query: { period, date },
    }),
  );
}

export type DrinkLogSummary = Awaited<ReturnType<typeof getDrinkLogSummary>>;

export function useDrinkLogSummary(period: SummaryPeriod, date: string) {
  return useQuery({
    queryKey: queryKeys.drinkLogSummary(period, date),
    queryFn: () => getDrinkLogSummary(period, date),
  });
}
