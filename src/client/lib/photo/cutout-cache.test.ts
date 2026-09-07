import { describe, expect, it } from "vitest";
import { createLruCache, createSharedSegmentation } from "./cutout-cache.ts";
import { CutoutError } from "./cutout-result.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createLruCache", () => {
  it("上限を超えると最も古いものを捨て、参照で新しくなる", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.size).toBe(2);
  });
});

describe("createSharedSegmentation", () => {
  it("同じ key は 1 回しか実行せず、2 回目以降はキャッシュから返す（preview → 使う）", async () => {
    let runs = 0;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: async (input) => {
        runs += 1;
        return `mask:${input}`;
      },
    });
    const preview = await shared.request("k1", "img");
    const use = await shared.request("k1", "img");
    expect(preview).toEqual({ value: "mask:img", cached: false });
    expect(use).toEqual({ value: "mask:img", cached: true });
    expect(runs).toBe(1);
  });

  it("実行中の同じ key は同じ実行に相乗りする", async () => {
    const gate = deferred<string>();
    let runs = 0;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: () => {
        runs += 1;
        return gate.promise;
      },
    });
    const a = shared.request("k", "img");
    const b = shared.request("k", "img");
    expect(shared.inflightCount).toBe(1);
    gate.resolve("m");
    await expect(a).resolves.toEqual({ value: "m", cached: false });
    await expect(b).resolves.toEqual({ value: "m", cached: false });
    expect(runs).toBe(1);
    expect(shared.inflightCount).toBe(0);
  });

  it("依頼者が 1 人去っても実行は続き、結果はキャッシュされる", async () => {
    const gate = deferred<string>();
    let aborted = false;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: (_input, { signal }) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return gate.promise;
      },
    });
    const controller = new AbortController();
    const leaving = shared.request("k", "img", { signal: controller.signal });
    const staying = shared.request("k", "img");
    controller.abort();
    await expect(leaving).rejects.toMatchObject({ reason: "superseded" });
    expect(aborted).toBe(false);
    gate.resolve("m");
    await expect(staying).resolves.toEqual({ value: "m", cached: false });
    expect(shared.peek("k")).toBe("m");
  });

  it("依頼者が全員去ったら実行側へ abort を伝える", async () => {
    const gate = deferred<string>();
    let aborted = false;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: (_input, { signal }) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          gate.reject(new CutoutError("superseded"));
        });
        return gate.promise;
      },
    });
    const controller = new AbortController();
    const only = shared.request("k", "img", { signal: controller.signal });
    controller.abort();
    await expect(only).rejects.toMatchObject({ reason: "superseded" });
    expect(aborted).toBe(true);
    await Promise.resolve();
    expect(shared.peek("k")).toBeUndefined();
  });

  it("失敗はキャッシュせず、次の依頼で再実行する", async () => {
    let runs = 0;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: async () => {
        runs += 1;
        if (runs === 1) {
          throw new CutoutError("timeout");
        }
        return "ok";
      },
    });
    await expect(shared.request("k", "img")).rejects.toMatchObject({ reason: "timeout" });
    await expect(shared.request("k", "img")).resolves.toEqual({ value: "ok", cached: false });
    expect(runs).toBe(2);
  });

  it("中断済み signal は実行せず superseded", async () => {
    let runs = 0;
    const shared = createSharedSegmentation<string, string>({
      limit: 4,
      run: async () => {
        runs += 1;
        return "ok";
      },
    });
    const controller = new AbortController();
    controller.abort();
    await expect(shared.request("k", "img", { signal: controller.signal })).rejects.toMatchObject({
      reason: "superseded",
    });
    expect(runs).toBe(0);
  });

  it("キャッシュ上限を超えた古い key は再実行になる（メモリを溜めない）", async () => {
    let runs = 0;
    const shared = createSharedSegmentation<string, string>({
      limit: 2,
      run: async (input) => {
        runs += 1;
        return input;
      },
    });
    await shared.request("a", "a");
    await shared.request("b", "b");
    await shared.request("c", "c");
    expect(shared.cacheSize).toBe(2);
    await expect(shared.request("a", "a")).resolves.toMatchObject({ cached: false });
    expect(runs).toBe(4);
  });
});
