import { describe, expect, it } from "vitest";
import { CutoutError } from "./cutout-result.ts";
import { createLatestOnlyScheduler } from "./cutout-scheduler.ts";

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

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "resolved";
  } catch (error) {
    return error instanceof CutoutError ? error.reason : "other";
  }
}

describe("createLatestOnlyScheduler", () => {
  it("空いていれば即時に実行し、結果を返す", async () => {
    const scheduler = createLatestOnlyScheduler();
    await expect(scheduler.schedule(async () => 7)).resolves.toBe(7);
    expect(scheduler.stats).toEqual({ started: 1, superseded: 0 });
  });

  it("実行中は pending を最新 1 件だけ保持し、古い pending は superseded で捨てる", async () => {
    const scheduler = createLatestOnlyScheduler();
    const first = deferred<string>();
    const runs: string[] = [];
    const p1 = scheduler.schedule(() => {
      runs.push("1");
      return first.promise;
    });
    const results = ["2", "3", "4", "5"].map((id) =>
      scheduler.schedule(async () => {
        runs.push(id);
        return id;
      }),
    );
    await flush();
    expect(runs).toEqual(["1"]);
    expect(scheduler.hasPending).toBe(true);

    first.resolve("1");
    await expect(p1).resolves.toBe("1");
    const outcomes = await Promise.all(results.map(reasonOf));
    expect(outcomes).toEqual(["superseded", "superseded", "superseded", "resolved"]);
    expect(runs).toEqual(["1", "5"]);
    expect(scheduler.stats).toEqual({ started: 2, superseded: 3 });
  });

  it("10 回連続で依頼しても実行回数は 2 回（実行中 + 最新）に収まる", async () => {
    const scheduler = createLatestOnlyScheduler();
    const gate = deferred<void>();
    let executed = 0;
    const promises: Promise<number>[] = [];
    for (let i = 0; i < 10; i += 1) {
      promises.push(
        scheduler.schedule(async () => {
          executed += 1;
          await gate.promise;
          return i;
        }),
      );
    }
    gate.resolve();
    await Promise.allSettled(promises);
    expect(executed).toBe(2);
    expect(scheduler.stats.superseded).toBe(8);
  });

  it("hold した実処理が終わるまで次を始めない（timeout 後に推論を重ねない）", async () => {
    const scheduler = createLatestOnlyScheduler();
    const slowRun = deferred<void>();
    const runs: string[] = [];
    const timedOut = scheduler.schedule(async (context) => {
      runs.push("slow");
      context.hold(slowRun.promise);
      throw new CutoutError("timeout");
    });
    const next = scheduler.schedule(async () => {
      runs.push("next");
      return "ok";
    });
    await expect(timedOut).rejects.toMatchObject({ reason: "timeout" });
    await flush();
    expect(runs).toEqual(["slow"]);
    expect(scheduler.busy).toBe(true);

    slowRun.resolve();
    await expect(next).resolves.toBe("ok");
    expect(runs).toEqual(["slow", "next"]);
  });

  it("hold した実処理が失敗しても枠は解放される", async () => {
    const scheduler = createLatestOnlyScheduler();
    const slowRun = deferred<void>();
    void scheduler
      .schedule(async (context) => {
        context.hold(slowRun.promise);
        throw new CutoutError("timeout");
      })
      .catch(() => {});
    const next = scheduler.schedule(async () => "ok");
    slowRun.reject(new Error("late failure"));
    await expect(next).resolves.toBe("ok");
  });

  it("AbortSignal で pending を取り消せる。実行中は影響しない", async () => {
    const scheduler = createLatestOnlyScheduler();
    const first = deferred<string>();
    const controller = new AbortController();
    const running = scheduler.schedule(() => first.promise, { signal: controller.signal });
    let executed = false;
    const pending = scheduler.schedule(
      async () => {
        executed = true;
        return "pending";
      },
      { signal: controller.signal },
    );
    controller.abort();
    expect(scheduler.hasPending).toBe(false);
    await expect(reasonOf(pending)).resolves.toBe("superseded");
    first.resolve("first");
    await expect(running).resolves.toBe("first");
    await flush();
    expect(executed).toBe(false);
  });

  it("すでに中断済みの signal は即 superseded", async () => {
    const scheduler = createLatestOnlyScheduler();
    const controller = new AbortController();
    controller.abort();
    await expect(
      reasonOf(scheduler.schedule(async () => 1, { signal: controller.signal })),
    ).resolves.toBe("superseded");
    expect(scheduler.stats.started).toBe(0);
  });

  it("queueWaitMs は待ち時間を渡す", async () => {
    let clock = 0;
    const scheduler = createLatestOnlyScheduler(() => clock);
    const first = deferred<void>();
    void scheduler.schedule(() => first.promise);
    const waited = scheduler.schedule(async (context) => context.queueWaitMs);
    clock = 250;
    first.resolve();
    await expect(waited).resolves.toBe(250);
  });

  it("実行が失敗しても次の pending は実行される", async () => {
    const scheduler = createLatestOnlyScheduler();
    const first = deferred<void>();
    const failing = scheduler.schedule(() => first.promise);
    const next = scheduler.schedule(async () => "next");
    first.reject(new CutoutError("inference"));
    await expect(reasonOf(failing)).resolves.toBe("inference");
    await expect(next).resolves.toBe("next");
  });
});
