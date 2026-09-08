import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { DrinkType } from "@/shared/constants.ts";
import type { CreateTastingNoteInput, UpdateTastingNoteInput } from "@/shared/tasting-notes.ts";

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

export function createTastingNote(body: CreateTastingNoteInput, client: ApiClient = api) {
  return unwrap(client.api["tasting-notes"].$post({ json: body }));
}

export function recognizeNotePhoto(file: Blob, client: ApiClient = api) {
  return unwrap(
    client.api["tasting-notes"].recognize.$post({
      form: {
        file: new File([file], "note.jpg", { type: "image/jpeg" }),
      },
    }),
  );
}

export function updateTastingNote(
  id: string,
  body: UpdateTastingNoteInput,
  client: ApiClient = api,
) {
  return unwrap(client.api["tasting-notes"][":id"].$patch({ param: { id }, json: body }));
}

export function deleteTastingNote(id: string, client: ApiClient = api) {
  return unwrap(client.api["tasting-notes"][":id"].$delete({ param: { id } }));
}

export function useInfiniteTastingNotes(query: TastingNotesListQuery = {}, enabled = true) {
  return useInfiniteQuery({
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
    enabled,
  });
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

export function useCreateTastingNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTastingNoteInput) => createTastingNote(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tastingNotes }),
  });
}

export function useUpdateTastingNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTastingNoteInput }) =>
      updateTastingNote(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tastingNotes }),
  });
}

export function useDeleteTastingNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTastingNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tastingNotes }),
  });
}
