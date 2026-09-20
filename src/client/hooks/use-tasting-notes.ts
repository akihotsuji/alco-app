import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { DrinkType } from "@/shared/constants.ts";

export type TastingNotesListQuery = {
  bottleId?: string;
  q?: string;
  drinkType?: DrinkType;
  ratingX10Min?: number;
  limit?: number;
  cursor?: string;
};

function listQuery(query: TastingNotesListQuery) {
  return {
    limit: String(query.limit ?? 50),
    ...(query.bottleId ? { bottleId: query.bottleId } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.drinkType ? { drinkType: query.drinkType } : {}),
    ...(query.ratingX10Min !== undefined ? { ratingX10Min: String(query.ratingX10Min) } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export function getTastingNotes(query: TastingNotesListQuery = {}, client: ApiClient = api) {
  return unwrap(client.api["tasting-notes"].$get({ query: listQuery(query) }));
}

export function getTastingNote(id: string, client: ApiClient = api) {
  return unwrap(client.api["tasting-notes"][":id"].$get({ param: { id } }));
}

export function recognizeNotePhoto(_file: Blob): Promise<never> {
  return Promise.reject(new Error("ノート単独の認識は廃止しました"));
}

export function deleteTastingNote(id: string, client: ApiClient = api) {
  return unwrap(client.api["tasting-notes"][":id"].$delete({ param: { id } }));
}

/** ノート一覧。タブ先読みと同じキー・同じ queryFn を使う */
export function tastingNotesInfiniteQueryOptions(query: TastingNotesListQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.tastingNotesList({
      bottleId: query.bottleId,
      q: query.q,
      drinkType: query.drinkType,
      ratingX10Min: query.ratingX10Min,
      limit: query.limit,
    }),
    queryFn: ({ pageParam }) => getTastingNotes({ ...query, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useInfiniteTastingNotes(query: TastingNotesListQuery = {}, enabled = true) {
  return useInfiniteQuery({ ...tastingNotesInfiniteQueryOptions(query), enabled });
}

export function getTastingNotesByBottle(bottleId: string, client: ApiClient = api) {
  return unwrap(
    client.api["tasting-notes"].$get({
      query: { bottleId, limit: "3" },
    }),
  );
}

export function useTastingNotesByBottle(bottleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tastingNotesList({ bottleId: bottleId ?? "", limit: 3 }),
    queryFn: () => getTastingNotesByBottle(bottleId ?? ""),
    enabled: Boolean(bottleId),
  });
}

export function useTastingNote(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tastingNote(id ?? ""),
    queryFn: () => getTastingNote(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useDeleteTastingNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTastingNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tastingNotes }),
  });
}
