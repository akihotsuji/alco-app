import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiRequestError, isUnauthorizedError } from "./api.ts";

/** 個人アプリで他端末からの更新は稀。タブ復帰時の再取得で十分なので 30 秒は使い回す。 */
export const QUERY_STALE_TIME_MS = 30_000;

/** モバイル回線の一時的な失敗だけ拾う。4xx はサーバーの判定なので再試行しない。 */
export const QUERY_RETRY_COUNT = 1;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status < 500) {
    return false;
  }
  return failureCount < QUERY_RETRY_COUNT;
}

export type CreateQueryClientOptions = {
  /** セッション切れ（API 401）。query / mutation どちらで起きても 1 回呼ぶ。 */
  onUnauthorized: () => void;
};

export function createQueryClient({ onUnauthorized }: CreateQueryClientOptions): QueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorizedError(error)) {
      onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
