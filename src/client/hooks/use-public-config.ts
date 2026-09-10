import { queryOptions, useQuery } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { publicConfigSchema } from "@/shared/turnstile.ts";

export function publicConfigQueryOptions(client: ApiClient = api) {
  return queryOptions({
    queryKey: queryKeys.publicConfig,
    queryFn: async () => publicConfigSchema.parse(await unwrap(client.api.config.$get())),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function usePublicConfig() {
  return useQuery(publicConfigQueryOptions());
}
