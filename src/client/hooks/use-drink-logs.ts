import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { CreateDrinkLogInput } from "@/shared/drink-logs.ts";

export function createDrinkLog(body: CreateDrinkLogInput, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"].$post({ json: body }));
}

export function deleteDrinkLog(id: string, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"][":id"].$delete({ param: { id } }));
}

/** 楽観更新はしない。成功後に drink-logs 系のクエリを無効化して再取得させる */
export function useCreateDrinkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDrinkLogInput) => createDrinkLog(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs }),
  });
}

export function useDeleteDrinkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDrinkLog(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs }),
  });
}
