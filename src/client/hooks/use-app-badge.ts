import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useMe } from "@/client/hooks/use-me.ts";
import { socialUnreadQueryOptions } from "@/client/hooks/use-social.ts";
import { syncAppBadge } from "@/client/lib/app-badge.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";

/**
 * F2 と同じ未読数（`queryKeys.socialUnread`）をアイコンのバッジへ写す（pwa.md 6.2）。
 * 年齢未確認では未読 API が 403 なので取りに行かない。消す側（ログアウト・削除）は呼び出し元が持つ。
 */
export function useAppBadgeSync(): void {
  const queryClient = useQueryClient();
  const me = useMe();
  const enabled = me.data?.ageVerified === true;
  const unread = useQuery({ ...socialUnreadQueryOptions(), enabled });
  const count = unread.data?.count;
  const fetchedAt = unread.dataUpdatedAt;

  // 件数が同じでも取得のたびに書き直す（別タブのログアウト等で消えた分を戻す）
  useEffect(() => {
    if (count === undefined || fetchedAt === 0) {
      return;
    }
    void syncAppBadge(count);
  }, [count, fetchedAt]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialUnread });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, queryClient]);
}
