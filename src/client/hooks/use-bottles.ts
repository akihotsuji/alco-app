import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { BottleView, CreateBottleInput, UpdateBottleInput } from "@/shared/bottles.ts";
import type { DrinkType } from "@/shared/constants.ts";

export type BottlesListQuery = {
  view?: BottleView;
  q?: string;
  drinkType?: DrinkType;
  limit?: number;
  cursor?: string;
};

function listQuery(query: BottlesListQuery) {
  return {
    view: query.view ?? "cellar",
    limit: String(query.limit ?? 50),
    ...(query.q ? { q: query.q } : {}),
    ...(query.drinkType ? { drinkType: query.drinkType } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export function getBottles(query: BottlesListQuery = {}, client: ApiClient = api) {
  return unwrap(client.api.bottles.$get({ query: listQuery(query) }));
}

export function getBottle(id: string, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].$get({ param: { id } }));
}

export function createBottles(body: CreateBottleInput, client: ApiClient = api) {
  return unwrap(client.api.bottles.$post({ json: body }));
}

export function updateBottle(id: string, body: UpdateBottleInput, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].$patch({ param: { id }, json: body }));
}

export function deleteBottle(id: string, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].$delete({ param: { id } }));
}

export function consumeBottle(id: string, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].consume.$post({ param: { id } }));
}

export function restoreBottle(id: string, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].restore.$post({ param: { id } }));
}

export function useBottles(query: BottlesListQuery = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.bottlesList({
      view: query.view,
      q: query.q,
      drinkType: query.drinkType,
    }),
    queryFn: () => getBottles(query),
    enabled,
  });
}

export function useInfiniteBottles(query: BottlesListQuery = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.bottlesList({
      view: query.view,
      q: query.q,
      drinkType: query.drinkType,
      limit: query.limit,
    }),
    queryFn: ({ pageParam }) => getBottles({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

export function useBottle(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bottle(id ?? ""),
    queryFn: () => getBottle(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCreateBottles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBottleInput) => createBottles(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bottles }),
  });
}

export function useUpdateBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBottleInput }) => updateBottle(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bottles }),
  });
}

export function useDeleteBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBottle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
    },
  });
}

export function useConsumeBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => consumeBottle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bottles }),
  });
}

export function useRestoreBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreBottle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bottles }),
  });
}
