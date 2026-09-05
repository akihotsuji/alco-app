import { queryOptions, useQuery } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";

/** `GET /api/me`（`{ id, email, name }`）。テストから別クライアントを差し込めるよう分けている。 */
export function meQueryOptions(client: ApiClient = api) {
  return queryOptions({
    queryKey: queryKeys.me,
    queryFn: () => unwrap(client.api.me.$get()),
  });
}

export function useMe() {
  return useQuery(meQueryOptions());
}
