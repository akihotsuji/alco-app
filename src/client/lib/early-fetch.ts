/** 起動 script と本バンドルは別エントリなので、先読み応答は window 経由で渡す */

export type EarlyFetchStore = {
  put(key: string, pending: Promise<Response>): void;
  take(key: string): Promise<Response> | undefined;
};

export function earlyFetchKey(input: RequestInfo | URL): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, "http://localhost");
  return `${url.pathname}${url.search}`;
}

export function browserEarlyFetchStore(): EarlyFetchStore | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.__alcoEarlyFetch;
}

/**
 * 先読みの 401 は渡さない（reject して呼び出し側の live fetch に切り替えさせる）。
 * 未ログインで開いてからログインすると、使われずに残った起動時の 401 がログイン後の
 * 最初の query に渡り、セッション切れと判定されてサインアウトされるため。
 */
export function takeEarlyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  store = browserEarlyFetchStore(),
): Promise<Response> | undefined {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" || !store) {
    return undefined;
  }
  const pending = store.take(earlyFetchKey(input));
  if (!pending) {
    return undefined;
  }
  return pending.then((response) => {
    if (response.status === 401) {
      throw new Error("early fetch was unauthorized");
    }
    return response.clone();
  });
}
