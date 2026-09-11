import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { markCellarLocalWrite } from "@/client/lib/cellar-share.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type {
  AcceptInvitationInput,
  CreateCellarInput,
  CreateTransferInput,
  DeleteCellarInput,
  MoveBottlesInput,
  UpdateCellarInput,
} from "@/shared/cellars.ts";

export function getCellars(client: ApiClient = api) {
  return unwrap(client.api.cellars.$get());
}

export function getCellar(id: string, client: ApiClient = api) {
  return unwrap(client.api.cellars[":id"].$get({ param: { id } }));
}

export function getCellarRevision(id: string, client: ApiClient = api) {
  return unwrap(client.api.cellars[":id"].revision.$get({ param: { id } }));
}

export function getCellarMembers(id: string, client: ApiClient = api) {
  return unwrap(client.api.cellars[":id"].members.$get({ param: { id } }));
}

export function getCellarInvitations(id: string, client: ApiClient = api) {
  return unwrap(client.api.cellars[":id"].invitations.$get({ param: { id } }));
}

export function getCellarActivity(
  id: string,
  query: { limit?: string; cursor?: string } = {},
  client: ApiClient = api,
) {
  return unwrap(client.api.cellars[":id"].activity.$get({ param: { id }, query }));
}

export function cellarsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.cellarsList,
    queryFn: () => getCellars(),
  });
}

export function useCellars() {
  return useQuery(cellarsQueryOptions());
}

export function useCellar(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cellar(id ?? ""),
    queryFn: () => getCellar(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCellarMembers(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cellarMembers(id ?? ""),
    queryFn: () => getCellarMembers(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCellarInvitations(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cellarInvitations(id ?? ""),
    queryFn: () => getCellarInvitations(id ?? ""),
    enabled: Boolean(id) && enabled,
  });
}

export function useCellarActivity(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cellarActivity(id ?? ""),
    queryFn: () => getCellarActivity(id ?? ""),
    enabled: Boolean(id),
  });
}

function invalidateCellars(queryClient: ReturnType<typeof useQueryClient>) {
  markCellarLocalWrite();
  void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
  void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
}

export function useCreateSharedCellar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCellarInput) => unwrap(api.api.cellars.$post({ json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useUpdateCellarName(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCellarInput) =>
      unwrap(api.api.cellars[":id"].$patch({ param: { id: cellarId }, json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useDeleteSharedCellar(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DeleteCellarInput) =>
      unwrap(api.api.cellars[":id"].$delete({ param: { id: cellarId }, json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useLeaveSharedCellar(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationKey: string) =>
      unwrap(
        api.api.cellars[":id"].leave.$post({
          param: { id: cellarId },
          json: { operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useRemoveCellarMember(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; operationKey: string }) =>
      unwrap(
        api.api.cellars[":id"].members[":userId"].$delete({
          param: { id: cellarId, userId: input.userId },
          json: { operationKey: input.operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useCreateInvitation(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationKey: string) =>
      unwrap(
        api.api.cellars[":id"].invitations.$post({
          param: { id: cellarId },
          json: { operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useRevokeInvitation(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { invitationId: string; operationKey: string }) =>
      unwrap(
        api.api.cellars[":id"].invitations[":invitationId"].revoke.$post({
          param: { id: cellarId, invitationId: input.invitationId },
          json: { operationKey: input.operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function usePreviewInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      unwrap(api.api["cellar-invitations"].preview.$post({ json: { token } })),
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptInvitationInput) =>
      unwrap(api.api["cellar-invitations"].accept.$post({ json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useCreateOwnerTransfer(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransferInput) =>
      unwrap(api.api.cellars[":id"].transfers.$post({ param: { id: cellarId }, json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useAcceptOwnerTransfer(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { transferId: string; operationKey: string }) =>
      unwrap(
        api.api.cellars[":id"].transfers[":transferId"].accept.$post({
          param: { id: cellarId, transferId: input.transferId },
          json: { operationKey: input.operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useCancelOwnerTransfer(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { transferId: string; operationKey: string }) =>
      unwrap(
        api.api.cellars[":id"].transfers[":transferId"].cancel.$post({
          param: { id: cellarId, transferId: input.transferId },
          json: { operationKey: input.operationKey },
        }),
      ),
    onSuccess: () => invalidateCellars(queryClient),
  });
}

export function useMoveBottlesToShared(cellarId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MoveBottlesInput) =>
      unwrap(api.api.cellars[":id"].moves.$post({ param: { id: cellarId }, json: body })),
    onSuccess: () => invalidateCellars(queryClient),
  });
}
