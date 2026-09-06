import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";

export type MyDrinkBody = {
  name: string;
  drinkType: "wine" | "beer" | "whisky" | "sake" | "shochu" | "cocktail" | "other";
  volumeMl: number;
  abvPercent: number;
  sortOrder?: number;
};

export function getMyDrinks(client: ApiClient = api) {
  return unwrap(client.api["my-drinks"].$get({ query: { limit: "30" } }));
}

export function getMyDrink(id: string, client: ApiClient = api) {
  return unwrap(client.api["my-drinks"][":id"].$get({ param: { id } }));
}

export function createMyDrink(body: MyDrinkBody, client: ApiClient = api) {
  return unwrap(client.api["my-drinks"].$post({ json: body }));
}

export function updateMyDrink(id: string, body: Partial<MyDrinkBody>, client: ApiClient = api) {
  return unwrap(client.api["my-drinks"][":id"].$patch({ param: { id }, json: body }));
}

export function deleteMyDrink(id: string, client: ApiClient = api) {
  return unwrap(client.api["my-drinks"][":id"].$delete({ param: { id } }));
}

export function logMyDrink(
  id: string,
  body: { drunkAt?: string; memo?: string | null },
  client: ApiClient = api,
) {
  return unwrap(client.api["my-drinks"][":id"].log.$post({ param: { id }, json: body }));
}

export type MyDrink = Awaited<ReturnType<typeof getMyDrink>>;

export function useMyDrinks() {
  return useQuery({
    queryKey: queryKeys.myDrinks,
    queryFn: () => getMyDrinks(),
  });
}

export function useMyDrink(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myDrink(id ?? ""),
    queryFn: () => getMyDrink(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCreateMyDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MyDrinkBody) => createMyDrink(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myDrinks }),
  });
}

export function useUpdateMyDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MyDrinkBody> }) =>
      updateMyDrink(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myDrinks }),
  });
}

export function useDeleteMyDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMyDrink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.myDrinks }),
  });
}

export function useLogMyDrink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { drunkAt?: string; memo?: string | null } }) =>
      logMyDrink(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogSummaries });
    },
  });
}
