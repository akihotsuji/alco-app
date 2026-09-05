import { queryOptions, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { type RpcClient, rpc, unwrap } from "@/client/lib/api.ts";

export type Me = InferResponseType<typeof rpc.api.me.$get, 200>;

export const meQueryKey = ["me"] as const;

/** `GET /api/me`（`{ id, email, name }`）。テストではクライアントを差し替える。 */
export function meQueryOptions(client: RpcClient = rpc) {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: (): Promise<Me> => unwrap(client.api.me.$get()),
  });
}

export function useMe() {
  return useQuery(meQueryOptions());
}
