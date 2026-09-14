import { CutoutError } from "./cutout-result.ts";

export type ScheduleContext = {
  /** 待ち行列に入ってから実行開始までの時間 */
  queueWaitMs: number;
  /**
   * 実行枠を `promise` が確定するまで保持する。ONNX の `session.run()` は途中で止められないので、
   * タイムアウトで呼び出し元へ失敗を返した後も、実処理が終わるまで次の推論を始めない（Issue #48 A-3）。
   */
  hold: (promise: Promise<unknown>) => void;
};

export type CutoutQueuePolicy = "latest" | "fifo";

export type ScheduleOptions = {
  /** 中断されたら pending のうちは取り消す（実行中なら結果を捨てるだけ） */
  signal?: AbortSignal;
  /**
   * `latest`: 編集プレビュー。pending は最新 1 件。
   * `fifo`: 保存・バッチの別写真。superseded で捨てない。
   */
  policy?: CutoutQueuePolicy;
};

export type CutoutScheduler = {
  schedule<T>(
    work: (context: ScheduleContext) => Promise<T>,
    options?: ScheduleOptions,
  ): Promise<T>;
  readonly stats: { started: number; superseded: number };
  readonly busy: boolean;
  readonly hasPending: boolean;
};

export type LatestOnlyScheduler = CutoutScheduler;

type Entry = {
  run: (context: ScheduleContext) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
  detachAbort: () => void;
};

/**
 * 推論は 1 本ずつ。プレビューは pending 最新 1 件、保存・バッチは FIFO。
 * ONNX の `session.run()` は途中で止められないので、hold 中は次を始めない。
 */
export function createCutoutScheduler(now: () => number = () => Date.now()): CutoutScheduler {
  let running = false;
  let latestPending: Entry | null = null;
  const fifoPending: Entry[] = [];
  const stats = { started: 0, superseded: 0 };

  function supersede(entry: Entry): void {
    entry.detachAbort();
    stats.superseded += 1;
    entry.reject(new CutoutError("superseded"));
  }

  function takeNext(): Entry | null {
    const fifo = fifoPending.shift();
    if (fifo) {
      return fifo;
    }
    const latest = latestPending;
    latestPending = null;
    return latest;
  }

  function start(entry: Entry): void {
    running = true;
    stats.started += 1;
    entry.detachAbort();
    const holds: Promise<unknown>[] = [];
    const context: ScheduleContext = {
      queueWaitMs: Math.max(0, now() - entry.enqueuedAt),
      hold: (promise) => {
        holds.push(
          promise.then(
            () => undefined,
            () => undefined,
          ),
        );
      },
    };
    Promise.resolve()
      .then(() => entry.run(context))
      .then(entry.resolve, entry.reject)
      .then(() => Promise.all(holds))
      .then(() => {
        running = false;
        const next = takeNext();
        if (next) {
          start(next);
        }
      });
  }

  return {
    schedule<T>(work: (context: ScheduleContext) => Promise<T>, options?: ScheduleOptions) {
      return new Promise<T>((resolve, reject) => {
        const signal = options?.signal;
        const policy = options?.policy ?? "latest";
        if (signal?.aborted) {
          reject(new CutoutError("superseded"));
          return;
        }
        const entry: Entry = {
          run: work,
          resolve: (value) => resolve(value as T),
          reject,
          enqueuedAt: now(),
          detachAbort: () => {},
        };
        if (!running) {
          start(entry);
          return;
        }
        if (policy === "fifo") {
          fifoPending.push(entry);
        } else {
          if (latestPending) {
            supersede(latestPending);
          }
          latestPending = entry;
        }
        if (signal) {
          const onAbort = () => {
            if (latestPending === entry) {
              latestPending = null;
              supersede(entry);
              return;
            }
            const index = fifoPending.indexOf(entry);
            if (index >= 0) {
              fifoPending.splice(index, 1);
              supersede(entry);
            }
          };
          signal.addEventListener("abort", onAbort, { once: true });
          entry.detachAbort = () => signal.removeEventListener("abort", onAbort);
        }
      });
    },
    get stats() {
      return { ...stats };
    },
    get busy() {
      return running;
    },
    get hasPending() {
      return latestPending !== null || fifoPending.length > 0;
    },
  };
}

/**
 * 編集プレビュー用。実行中 1 件 + pending 最新 1 件。古い pending は `superseded`。
 */
export function createLatestOnlyScheduler(
  now: () => number = () => Date.now(),
): LatestOnlyScheduler {
  const inner = createCutoutScheduler(now);
  return {
    schedule(work, options) {
      return inner.schedule(work, { ...options, policy: "latest" });
    },
    get stats() {
      return inner.stats;
    },
    get busy() {
      return inner.busy;
    },
    get hasPending() {
      return inner.hasPending;
    },
  };
}
