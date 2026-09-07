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

export type ScheduleOptions = {
  /** 中断されたら pending のうちは取り消す（実行中なら結果を捨てるだけ） */
  signal?: AbortSignal;
};

export type LatestOnlyScheduler = {
  schedule<T>(
    work: (context: ScheduleContext) => Promise<T>,
    options?: ScheduleOptions,
  ): Promise<T>;
  readonly stats: { started: number; superseded: number };
  readonly busy: boolean;
  readonly hasPending: boolean;
};

type Entry = {
  run: (context: ScheduleContext) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
  detachAbort: () => void;
};

/**
 * 実行中 1 件 + pending 最新 1 件。古い pending は `superseded` で置き換える。
 * 「10 回操作したら 10 回推論する」FIFO をなくす（Issue #48 A-2 / 8）。
 */
export function createLatestOnlyScheduler(
  now: () => number = () => Date.now(),
): LatestOnlyScheduler {
  let running = false;
  let pending: Entry | null = null;
  const stats = { started: 0, superseded: 0 };

  function supersede(entry: Entry): void {
    entry.detachAbort();
    stats.superseded += 1;
    entry.reject(new CutoutError("superseded"));
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
        const next = pending;
        pending = null;
        if (next) {
          start(next);
        }
      });
  }

  return {
    schedule<T>(work: (context: ScheduleContext) => Promise<T>, options?: ScheduleOptions) {
      return new Promise<T>((resolve, reject) => {
        const signal = options?.signal;
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
        if (pending) {
          supersede(pending);
        }
        pending = entry;
        if (signal) {
          const onAbort = () => {
            if (pending === entry) {
              pending = null;
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
      return pending !== null;
    },
  };
}
