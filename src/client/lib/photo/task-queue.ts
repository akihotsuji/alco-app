export class TaskQueueCancelledError extends Error {
  constructor() {
    super("task_queue_cancelled");
    this.name = "TaskQueueCancelledError";
  }
}

export type TaskQueue = {
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  readonly active: number;
  readonly pending: number;
};

/** 同時実行数を上限にして、残りは順番待ち。中断済みの待ちは task を呼ばない */
export function createTaskQueue(concurrency: number): TaskQueue {
  let active = 0;
  const waiting: Array<() => void> = [];

  function release(): void {
    active = Math.max(0, active - 1);
    waiting.shift()?.();
  }

  function acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(new TaskQueueCancelledError());
    }
    if (active < concurrency) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const entry = () => {
        signal?.removeEventListener("abort", onAbort);
        active += 1;
        resolve();
      };
      const onAbort = () => {
        const index = waiting.indexOf(entry);
        if (index >= 0) {
          waiting.splice(index, 1);
        }
        reject(new TaskQueueCancelledError());
      };
      waiting.push(entry);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  return {
    async run(task, signal) {
      await acquire(signal);
      try {
        if (signal?.aborted) {
          throw new TaskQueueCancelledError();
        }
        return await task();
      } finally {
        release();
      }
    },
    get active() {
      return active;
    },
    get pending() {
      return waiting.length;
    },
  };
}
