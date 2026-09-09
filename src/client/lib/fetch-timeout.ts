export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetchImpl(input, { ...init, signal });
}

/**
 * 先読みが成功すればそれを使い、失敗・タイムアウトなら live fetch へ。
 * 先に決まった側だけを採用し、遅れて来た古い応答では上書きしない。
 */
export function settleEarlyFetch(
  early: Promise<Response>,
  fallback: () => Promise<Response>,
  timeoutMs: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (next: Promise<Response>) => {
      if (settled) {
        return;
      }
      settled = true;
      next.then(resolve, reject);
    };

    const timer = setTimeout(() => {
      finish(fallback());
    }, timeoutMs);

    early.then(
      (response) => {
        clearTimeout(timer);
        finish(Promise.resolve(response));
      },
      () => {
        clearTimeout(timer);
        finish(fallback());
      },
    );
  });
}

export function createTimedFetch(options: {
  fetchImpl: typeof fetch;
  takeEarly: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | undefined;
  timeoutMs: number;
}): typeof fetch {
  return (input, init) => {
    const early = options.takeEarly(input, init);
    const live = () => fetchWithTimeout(input, init, options.fetchImpl, options.timeoutMs);
    if (early) {
      return settleEarlyFetch(early, live, options.timeoutMs);
    }
    return live();
  };
}
