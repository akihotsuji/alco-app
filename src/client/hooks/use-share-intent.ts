import { useEffect, useState } from "react";
import {
  useCreateShare,
  useSocialMe,
  useSocialPreferences,
  useSocialSources,
} from "@/client/hooks/use-social.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { newSocialOperationKey } from "@/client/lib/social-invite.ts";
import { SOCIAL_COPY, SOCIAL_MESSAGES, type SocialShareSource } from "@/shared/social.ts";

export function useShareIntent() {
  const me = useSocialMe();
  const prefs = useSocialPreferences();
  const createShare = useCreateShare();
  const canShare = Boolean(me.data?.profileCompleted && (me.data.friendCount ?? 0) > 0);
  const reason = !me.data?.profileCompleted
    ? SOCIAL_MESSAGES.profileRequired
    : (me.data?.friendCount ?? 0) === 0
      ? SOCIAL_MESSAGES.noFriends
      : null;
  const [shareOn, setShareOn] = useState(true);
  useEffect(() => {
    if (prefs.data) {
      setShareOn(prefs.data.shareDefaultOn);
    }
  }, [prefs.data]);

  async function shareIfNeeded(source: SocialShareSource): Promise<"ok" | "skipped" | "failed"> {
    if (!canShare || !shareOn) {
      return "skipped";
    }
    try {
      await createShare.mutateAsync({ operationKey: newSocialOperationKey(), source });
      return "ok";
    } catch {
      return "failed";
    }
  }

  return {
    shareOn,
    setShareOn,
    canShare,
    reason,
    shareIfNeeded,
    sharing: createShare.isPending,
    shareFailedMessage: SOCIAL_COPY.shareFailedAfterSave,
    isShareConflict: (error: unknown) => isApiClientError(error) && error.code === "conflict",
  };
}

export function useOpeningSource(bottleId: string | undefined) {
  return useSocialSources({ bottleId, enabled: Boolean(bottleId) });
}
