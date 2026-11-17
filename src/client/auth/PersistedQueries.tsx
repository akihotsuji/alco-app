import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef } from "react";
import { restorePersistedQueries, startQueryPersistence } from "@/client/lib/query-persist.ts";

/**
 * 認証後の最初の描画の前に一覧を戻し、その後の更新を端末へ書く。
 * userId が変わったら親が key を変えて付け直す。
 */
export function PersistedQueries({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const restoredFor = useRef<string | null>(null);
  if (restoredFor.current !== userId) {
    restorePersistedQueries(queryClient, userId);
    restoredFor.current = userId;
  }

  useEffect(() => startQueryPersistence(queryClient, userId), [queryClient, userId]);

  return children;
}
