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
  return pending.then((response) => response.clone());
}
