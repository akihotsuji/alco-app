import { describe, expect, it } from "vitest";
import { createTaskQueue, TaskQueueCancelledError } from "./task-queue.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe("createTaskQueue", () => {
  it("同時実行は concurrency まで。残りは待ち、完了後に進む", async () => {
    const queue = createTaskQueue(2);
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
    let active = 0;
    let peak = 0;
    const run = (index: number) =>
      queue.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await gates[index]?.promise;
        active -= 1;
        return index;
      });
    const first = run(0);
    const second = run(1);
    const third = run(2);
    await flush();
    expect(queue.active).toBe(2);
    expect(queue.pending).toBe(1);
    expect(peak).toBe(2);
    gates[0]?.resolve();
    await expect(first).resolves.toBe(0);
    await flush();
    expect(queue.active).toBe(2);
    gates[1]?.resolve();
    gates[2]?.resolve();
    await expect(Promise.all([second, third])).resolves.toEqual([1, 2]);
    expect(peak).toBe(2);
    expect(queue.active).toBe(0);
  });

  it("待ち行列で abort した仕事は task を呼ばない。他の待ちは進む", async () => {
    const queue = createTaskQueue(1);
    const first = deferred<void>();
    let ranSecond = false;
    let ranThird = false;
    const controller = new AbortController();
    const running = queue.run(() => first.promise);
    const cancelled = queue.run(async () => {
      ranSecond = true;
    }, controller.signal);
    const next = queue.run(async () => {
      ranThird = true;
      return "ok";
    });
    await flush();
    controller.abort();
    await expect(cancelled).rejects.toBeInstanceOf(TaskQueueCancelledError);
    first.resolve();
    await expect(running).resolves.toBeUndefined();
    await expect(next).resolves.toBe("ok");
    expect(ranSecond).toBe(false);
    expect(ranThird).toBe(true);
  });

  it("開始前に中断済みなら即キャンセル", async () => {
    const queue = createTaskQueue(1);
    const controller = new AbortController();
    controller.abort();
    let ran = false;
    await expect(
      queue.run(async () => {
        ran = true;
      }, controller.signal),
    ).rejects.toBeInstanceOf(TaskQueueCancelledError);
    expect(ran).toBe(false);
  });
});
