import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type {
  CreateDrinkLogInput,
  DrinkLogsResponse,
  UpdateDrinkLogInput,
} from "@/shared/drink-logs.ts";
import type { DrinkLookupRequest } from "@/shared/drink-recognize.ts";

export function createDrinkLog(body: CreateDrinkLogInput, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"].$post({ json: body }));
}

export function recognizeDrinkPhoto(file: Blob, client: ApiClient = api) {
  return unwrap(
    client.api["drink-logs"].recognize.$post({
      form: {
        file: new File([file], "drink.jpg", { type: "image/jpeg" }),
      },
    }),
  );
}

/** 二段階の後半。抽出で得た品名・生産者から国・品種だけを照合する（ai-recognition.md 7a） */
export function lookupDrinkProduct(body: DrinkLookupRequest, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"].recognize.lookup.$post({ json: body }));
}

export function deleteDrinkLog(id: string, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"][":id"].$delete({ param: { id } }));
}

export function getDrinkLog(id: string, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"][":id"].$get({ param: { id } }));
}

export function updateDrinkLog(id: string, body: UpdateDrinkLogInput, client: ApiClient = api) {
  return unwrap(client.api["drink-logs"][":id"].$patch({ param: { id }, json: body }));
}

async function getDrinkLogsPage(date: string, cursor: string | undefined, client: ApiClient) {
  return unwrap(
    client.api["drink-logs"].$get({
      query: { date, limit: "100", ...(cursor ? { cursor } : {}) },
    }),
  );
}

/** 日別は追加UIを置かず、nextCursor が尽きるまで自動で連結する（E25）。 */
export async function getDrinkLogsDay(
  date: string,
  client: ApiClient = api,
): Promise<DrinkLogsResponse> {
  const first = await getDrinkLogsPage(date, undefined, client);
  const items = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await getDrinkLogsPage(date, cursor, client);
    items.push(...page.items);
    cursor = page.nextCursor;
  }
  return { ...first, items, nextCursor: null };
}

/** 楽観更新はしない。成功後に drink-logs 系のクエリを無効化して再取得させる */
export function useCreateDrinkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDrinkLogInput) => createDrinkLog(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogSummaries });
    },
  });
}

export function useDeleteDrinkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDrinkLog(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogSummaries });
    },
  });
}

export function useDrinkLogsDay(date: string) {
  return useQuery({
    queryKey: queryKeys.drinkLogsDay(date),
    queryFn: () => getDrinkLogsDay(date),
  });
}

export function getDrinkLogsByBottle(bottleId: string, client: ApiClient = api) {
  return unwrap(
    client.api["drink-logs"].$get({
      query: { bottleId, limit: "3" },
    }),
  );
}

export function useDrinkLogsByBottle(bottleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drinkLogsByBottle(bottleId ?? ""),
    queryFn: () => getDrinkLogsByBottle(bottleId ?? ""),
    enabled: Boolean(bottleId),
  });
}

export function useDrinkLog(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drinkLog(id ?? ""),
    queryFn: () => getDrinkLog(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useUpdateDrinkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDrinkLogInput }) =>
      updateDrinkLog(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogSummaries });
    },
  });
}
