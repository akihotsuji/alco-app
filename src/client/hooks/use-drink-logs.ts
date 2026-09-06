import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { agentDebug } from "@/client/lib/agent-debug.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { CreateDrinkLogInput } from "@/shared/drink-logs.ts";

export function createDrinkLog(body: CreateDrinkLogInput, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"].$post({ json: body }));
}

export async function deleteDrinkLog(id: string, client: ApiClient = api) {
  // #region agent log
  agentDebug({
    hypothesisId: "B",
    location: "use-drink-logs.ts:deleteDrinkLog:dispatch",
    message: "Delete drink log request dispatched",
    data: { logId: id },
    timestamp: Date.now(),
  });
  // #endregion
  const response = await client.api["drink-logs"][":id"].$delete({ param: { id } });
  const responseBody = await response.clone().text();
  // #region agent log
  agentDebug({
    hypothesisId: "B|C",
    location: "use-drink-logs.ts:deleteDrinkLog:response",
    message: "Delete drink log response received",
    data: {
      logId: id,
      status: response.status,
      ok: response.ok,
      body: responseBody,
    },
    timestamp: Date.now(),
  });
  // #endregion
  return unwrap(Promise.resolve(response));
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
