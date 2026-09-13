import {
  type InfiniteData,
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { markCellarLocalWrite } from "@/client/lib/cellar-share.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type {
  BottleGroup,
  BottleMutationBody,
  BottlesResponse,
  BottleView,
  CreateBottleInput,
  ReorderBottlesInput,
  UpdateBottleInput,
} from "@/shared/bottles.ts";
import type { BottleListScope } from "@/shared/cellars.ts";
import type { DrinkType } from "@/shared/constants.ts";

export type BottlesListQuery = {
  view?: BottleView;
  q?: string;
  drinkType?: DrinkType;
  group?: BottleGroup;
  limit?: number;
  cursor?: string;
  cellarId?: string;
  scope?: BottleListScope;
};

export function bottlesListQuery(query: BottlesListQuery) {
  return {
    view: query.view ?? "cellar",
    limit: String(query.limit ?? 50),
    ...(query.group ? { group: query.group } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.drinkType ? { drinkType: query.drinkType } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.cellarId ? { cellarId: query.cellarId } : {}),
    ...(query.scope ? { scope: query.scope } : {}),
  };
}

export function getBottles(query: BottlesListQuery = {}, client: ApiClient = api) {
  return unwrap(client.api.bottles.$get({ query: bottlesListQuery(query) }));
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

export function deleteBottle(id: string, body: BottleMutationBody = {}, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].$delete({ param: { id }, json: body }));
}

export function consumeBottle(id: string, body: BottleMutationBody = {}, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].consume.$post({ param: { id }, json: body }));
}

export function restoreBottle(id: string, body: BottleMutationBody = {}, client: ApiClient = api) {
  return unwrap(client.api.bottles[":id"].restore.$post({ param: { id }, json: body }));
}

export function reorderBottles(body: ReorderBottlesInput, client: ApiClient = api) {
  return unwrap(client.api.bottles.order.$put({ json: body }));
}

/** 表面は必須、裏面は任意。裏面があれば同じ 1 リクエストの `back` パートに載せる（回数は 1 回） */
export function recognizeLabel(file: Blob, back?: Blob | null, client: ApiClient = api) {
  return unwrap(
    client.api.bottles.recognize.$post({
      form: {
        file: new File([file], "label.jpg", { type: "image/jpeg" }),
        ...(back ? { back: new File([back], "back.jpg", { type: "image/jpeg" }) } : {}),
      },
    }),
  );
}

/** 単発の一覧（種類ごと表示の meta 等）。タブ先読みと同じキー・同じ queryFn を使う */
export function bottlesQueryOptions(query: BottlesListQuery = {}) {
  return queryOptions({
    queryKey: queryKeys.bottlesList({
      view: query.view,
      q: query.q,
      drinkType: query.drinkType,
      group: query.group,
      cellarId: query.cellarId,
      scope: query.scope,
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    }),
    queryFn: () => getBottles(query),
  });
}

/** 無限スクロールの一覧（1 本ずつ・種類ごとの棚・貯蔵庫）。タブ先読みと同じキー・同じ queryFn を使う */
export function bottlesInfiniteQueryOptions(query: BottlesListQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.bottlesList({
      view: query.view,
      q: query.q,
      drinkType: query.drinkType,
      group: query.group,
      limit: query.limit,
      cellarId: query.cellarId,
      scope: query.scope,
    }),
    queryFn: ({ pageParam }) => getBottles({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useBottles(query: BottlesListQuery = {}, enabled = true) {
  return useQuery({ ...bottlesQueryOptions(query), enabled });
}

export function useInfiniteBottles(
  query: BottlesListQuery = {},
  enabled = true,
  extras?: {
    initialData?: InfiniteData<BottlesResponse, string | undefined>;
    initialDataUpdatedAt?: number;
  },
) {
  return useInfiniteQuery({ ...bottlesInfiniteQueryOptions(query), enabled, ...extras });
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
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}

export function useUpdateBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBottleInput }) => updateBottle(id, body),
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}

export function useDeleteBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: BottleMutationBody }) => deleteBottle(id, body),
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}

export function useConsumeBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: BottleMutationBody }) =>
      consumeBottle(id, body),
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}

export function useRestoreBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: BottleMutationBody }) =>
      restoreBottle(id, body),
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}

export function useReorderBottles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderBottlesInput) => reorderBottles(body),
    onSuccess: () => {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    },
  });
}
