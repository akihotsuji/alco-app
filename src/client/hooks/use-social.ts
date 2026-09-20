import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import type { SocialFeed, SocialProfilePatch, SocialShareSource } from "@/shared/social.ts";

function invalidateSocial(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.socialFeed });
  void queryClient.invalidateQueries({ queryKey: queryKeys.socialMe });
  void queryClient.invalidateQueries({ queryKey: ["social-posts"] });
  void queryClient.invalidateQueries({ queryKey: ["social-profiles"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  void queryClient.invalidateQueries({ queryKey: queryKeys.socialNotifications });
  void queryClient.invalidateQueries({ queryKey: queryKeys.socialUnread });
  void queryClient.invalidateQueries({ queryKey: ["social-sources"] });
}

export function socialPhotoContentUrl(postId: string, photoId: string, variant?: "thumb"): string {
  const path = `/api/social/posts/${postId}/photos/${photoId}/content`;
  return variant ? `${path}?variant=${variant}` : path;
}

export function socialAvatarUrl(userId: string): string {
  return `/api/social/avatars/${userId}/content`;
}

export function getSocialMe(client: ApiClient = api) {
  return unwrap(client.api.social.me.$get());
}

export function getSocialPreferences(client: ApiClient = api) {
  return unwrap(client.api.social.preferences.$get());
}

export function useSocialMe() {
  return useQuery({
    queryKey: queryKeys.socialMe,
    queryFn: () => getSocialMe(),
  });
}

export function useSocialPreferences() {
  return useQuery({
    queryKey: queryKeys.socialPreferences,
    queryFn: () => getSocialPreferences(),
  });
}

export function useUpdateSocialProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SocialProfilePatch) => unwrap(api.api.social.me.$patch({ json: body })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useUpdateSocialPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareDefaultOn: boolean) =>
      unwrap(api.api.social.preferences.$patch({ json: { shareDefaultOn } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialPreferences });
    },
  });
}

export function useUploadSocialAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: Blob) =>
      unwrap(
        api.api.social.me.avatar.$post({
          form: { file: new File([file], "avatar.jpg", { type: file.type || "image/jpeg" }) },
        }),
      ),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useDeleteSocialAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.social.me.avatar.$delete()),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function socialFeedQueryOptions() {
  return {
    queryKey: queryKeys.socialFeed,
    queryFn: async ({ pageParam }: { pageParam?: string }) =>
      unwrap(
        api.api.social.feed.$get({
          query: { limit: "20", ...(pageParam ? { cursor: pageParam } : {}) },
        }),
      ) as Promise<SocialFeed>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: SocialFeed) => last.nextCursor ?? undefined,
  };
}

export function useSocialFeed() {
  return useInfiniteQuery(socialFeedQueryOptions());
}

export function useSocialPost(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.socialPost(id) : ["social-posts", "missing"],
    queryFn: () => unwrap(api.api.social.posts[":id"].$get({ param: { id: id ?? "" } })),
    enabled: Boolean(id),
  });
}

export function useSocialProfile(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.socialProfile(id) : ["social-profiles", "missing"],
    queryFn: () => unwrap(api.api.social.profiles[":id"].$get({ param: { id: id ?? "" } })),
    enabled: Boolean(id),
  });
}

export function useSocialProfilePosts(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: id ? queryKeys.socialProfilePosts(id) : ["social-profiles", "missing", "posts"],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      unwrap(
        api.api.social.profiles[":id"].posts.$get({
          param: { id: id ?? "" },
          query: { limit: "20", ...(pageParam ? { cursor: pageParam } : {}) },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(id),
  });
}

export function useSocialSources(query: {
  bottleId?: string;
  drinkLogId?: string;
  registrationBatchId?: string;
  enabled?: boolean;
}) {
  const enabled = Boolean(
    query.enabled ?? (query.bottleId || query.drinkLogId || query.registrationBatchId),
  );
  return useQuery({
    queryKey: queryKeys.socialSources(query),
    queryFn: () =>
      unwrap(
        api.api.social.sources.$get({
          query: {
            ...(query.bottleId ? { bottleId: query.bottleId } : {}),
            ...(query.drinkLogId ? { drinkLogId: query.drinkLogId } : {}),
            ...(query.registrationBatchId
              ? { registrationBatchId: query.registrationBatchId }
              : {}),
          },
        }),
      ),
    enabled,
  });
}

export function useCreateShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { operationKey: string; source: SocialShareSource }) =>
      unwrap(api.api.social.shares.$post({ json: input })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useUnsharePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.api.social.posts[":id"].$delete({ param: { id } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useReactionTypes() {
  return useQuery({
    queryKey: queryKeys.reactionTypes,
    queryFn: () => unwrap(api.api.social["reaction-types"].$get()),
    staleTime: 60_000,
  });
}

export function usePutReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; reactionTypeId: string }) =>
      unwrap(
        api.api.social.posts[":id"].reaction.$put({
          param: { id: input.postId },
          json: { reactionTypeId: input.reactionTypeId },
        }),
      ),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useDeleteReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) =>
      unwrap(api.api.social.posts[":id"].reaction.$delete({ param: { id: postId } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useFriends() {
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: () => unwrap(api.api.friends.$get()),
  });
}

export function useFriendInvitation(token?: string) {
  return useQuery({
    queryKey: [...queryKeys.friendInvitation, token ?? ""],
    queryFn: () => unwrap(api.api.friends.invitations.$get({ query: token ? { token } : {} })),
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.friends.invitations.$post()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.friendInvitation }),
  });
}

export function useReissueInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.friends.invitations.reissue.$post()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.friendInvitation }),
  });
}

export function useInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ["friend-invite-preview", token],
    queryFn: () =>
      unwrap(api.api.friends.invitations.preview.$get({ query: { token: token ?? "" } })),
    enabled: Boolean(token),
  });
}

export function useCreateFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => unwrap(api.api.friends.requests.$post({ json: { token } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.friends.requests[":id"].accept.$post({ param: { id } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.friends.requests[":id"].decline.$post({ param: { id } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useCancelFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.friends.requests[":id"].cancel.$post({ param: { id } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useUnfriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.api.friends[":userId"].$delete({ param: { userId } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: queryKeys.friendBlocks,
    queryFn: () => unwrap(api.api.friends.blocks.$get()),
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.api.friends.blocks[":userId"].$post({ param: { userId } })),
    onSuccess: () => invalidateSocial(queryClient),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.api.friends.blocks[":userId"].$delete({ param: { userId } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendBlocks });
    },
  });
}

export function useSocialNotifications() {
  return useInfiniteQuery({
    queryKey: queryKeys.socialNotifications,
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      unwrap(
        api.api.social.notifications.$get({
          query: { limit: "30", ...(pageParam ? { cursor: pageParam } : {}) },
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function socialUnreadQueryOptions() {
  return {
    queryKey: queryKeys.socialUnread,
    queryFn: () => unwrap(api.api.social.notifications["unread-count"].$get()),
  };
}

export function useUnreadCount() {
  return useQuery(socialUnreadQueryOptions());
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.social.notifications[":id"].$patch({ param: { id }, json: { read: true } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialNotifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialUnread });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.social.notifications["read-all"].$post()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialNotifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialUnread });
    },
  });
}
