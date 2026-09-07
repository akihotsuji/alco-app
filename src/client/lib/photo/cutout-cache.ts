import { CutoutError } from "./cutout-result.ts";

/** 挿入順の小さな LRU。値は Uint8Array のマスク程度を想定（上限 × 約 100KB） */
export function createLruCache<K, V>(limit: number) {
  const map = new Map<K, V>();
  return {
    get(key: K): V | undefined {
      const value = map.get(key);
      if (value !== undefined) {
        map.delete(key);
        map.set(key, value);
      }
      return value;
    },
    set(key: K, value: V): void {
      map.delete(key);
      map.set(key, value);
      while (map.size > limit) {
        const oldest = map.keys().next();
        if (oldest.done) {
          break;
        }
        map.delete(oldest.value);
      }
    },
    has(key: K): boolean {
      return map.has(key);
    },
    clear(): void {
      map.clear();
    },
    get size(): number {
      return map.size;
    },
  };
}

export type SharedRunOptions = {
  signal?: AbortSignal;
};

export type SharedRunner<I, V> = (input: I, options: { signal: AbortSignal }) => Promise<V>;

export type SharedResult<V> = { value: V; cached: boolean };

/**
 * 同じ key の実行を 1 本にまとめ、完了結果をキャッシュする。
 * - 完了済み: 実行せず返す（preview → 「使う」の再利用）
 * - 実行中: 同じ Promise に相乗りする
 * - 依頼者が全員中断したときだけ実行側へ abort を伝える（1 人が去っても走っている推論の結果は残す）
 */
export function createSharedSegmentation<I, V>(input: { limit: number; run: SharedRunner<I, V> }) {
  const cache = createLruCache<string, V>(input.limit);
  const inflight = new Map<
    string,
    { promise: Promise<V>; controller: AbortController; waiters: number }
  >();

  function request(
    key: string,
    payload: I,
    options: SharedRunOptions = {},
  ): Promise<SharedResult<V>> {
    const hit = cache.get(key);
    if (hit !== undefined) {
      return Promise.resolve({ value: hit, cached: true });
    }
    if (options.signal?.aborted) {
      return Promise.reject(new CutoutError("superseded"));
    }
    let entry = inflight.get(key);
    if (!entry) {
      const controller = new AbortController();
      const promise = input
        .run(payload, { signal: controller.signal })
        .then((value) => {
          cache.set(key, value);
          return value;
        })
        .finally(() => {
          if (inflight.get(key)?.promise === promise) {
            inflight.delete(key);
          }
        });
      entry = { promise, controller, waiters: 0 };
      inflight.set(key, entry);
    }
    const shared = entry;
    shared.waiters += 1;
    return new Promise<SharedResult<V>>((resolve, reject) => {
      const signal = options.signal;
      let settled = false;
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        shared.waiters -= 1;
        if (shared.waiters === 0) {
          shared.controller.abort();
        }
        reject(new CutoutError("superseded"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      shared.promise.then(
        (value) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          resolve({ value, cached: false });
        },
        (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
      );
    });
  }

  return {
    request,
    peek(key: string): V | undefined {
      return cache.get(key);
    },
    clear(): void {
      cache.clear();
    },
    get inflightCount(): number {
      return inflight.size;
    },
    get cacheSize(): number {
      return cache.size;
    },
  };
}
