import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isApiClientError, isUnauthorizedError } from "./api.ts";

/** 個人アプリなのでタブ切替や再マウントでは 30 秒まで再取得しない。mutation 後は invalidate で取り直す。 */
export const QUERY_STALE_TIME_MS = 30_000;

/**
 * 画面を離れた query を捨てるまでの時間。既定（5 分）だと 5 分ぶり のタブ切替でスケルトンに戻る。
 * 古いデータは即座に描き、裏で再取得（stale-while-revalidate）する方が「開いた瞬間に見える」。
 * ログアウト時は `RequireAuth` が `clear()` するので、他ユーザーの応答が残ることはない。
 */
export const QUERY_GC_TIME_MS = 24 * 60 * 60 * 1000;

/** ネットワーク断・5xx は 1 回だけ再試行する。4xx は再試行しても結果が変わらない。 */
export const QUERY_RETRY_LIMIT = 1;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiClientError(error) && error.status < 500) {
    return false;
  }
  return failureCount < QUERY_RETRY_LIMIT;
}

export type CreateQueryClientOptions = {
  /** query / mutation が 401 を受けたときに 1 回ずつ呼ばれる。ログイン導線への誘導はここで行う。 */
  onUnauthorized?: (queryClient: QueryClient) => void;
};

export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  const handleError = (error: unknown) => {
    if (isUnauthorizedError(error)) {
      options.onUnauthorized?.(queryClient);
    }
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return queryClient;
}
