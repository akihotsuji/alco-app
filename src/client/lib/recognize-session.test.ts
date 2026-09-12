import { beforeEach, describe, expect, it } from "vitest";
import type { RecognizeResponse } from "@/shared/label-recognize.ts";
import { clearPhotoMetrics, getRecentPhotoMetrics } from "./photo/photo-metrics.ts";
import {
  forgetAllRecognition,
  forgetLabelRecognition,
  LABEL_RECOGNIZE_CONCURRENCY,
  RecognitionCancelledError,
  startDrinkRecognition,
  startLabelRecognition,
  startNoteRecognition,
} from "./recognize-session.ts";

const response: RecognizeResponse = {
  fields: { name: { value: "Test", confidence: 0.9 } },
  provider: "workers-ai",
  remainingToday: 29,
};

describe("startLabelRecognition", () => {
  beforeEach(() => {
    clearPhotoMetrics();
  });

  it("同じ Blob は 1 リクエストにまとめ、同じ Promise を返す", async () => {
    const jpeg = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    let calls = 0;
    const run = async () => {
      calls += 1;
      return response;
    };
    const early = startLabelRecognition(jpeg, run);
    const later = startLabelRecognition(jpeg, run);
    expect(later).toBe(early);
    await expect(later).resolves.toEqual(response);
    expect(calls).toBe(1);
    forgetLabelRecognition(jpeg);
  });

  it("別の Blob は別リクエスト", async () => {
    let calls = 0;
    const run = async () => {
      calls += 1;
      return response;
    };
    const a = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    const b = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    await Promise.all([startLabelRecognition(a, run), startLabelRecognition(b, run)]);
    expect(calls).toBe(2);
  });

  it("失敗は購読者へ伝わり、unhandled rejection にならず、記録される", async () => {
    const jpeg = new Blob([new Uint8Array([9])], { type: "image/jpeg" });
    const failing = async (): Promise<RecognizeResponse> => {
      throw new Error("upstream");
    };
    const early = startLabelRecognition(jpeg, failing);
    await Promise.resolve();
    await expect(startLabelRecognition(jpeg, failing)).rejects.toThrow("upstream");
    await expect(early).rejects.toThrow("upstream");
    const metrics = getRecentPhotoMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ kind: "recognize", ok: false, fieldCount: 0 });
  });

  it("成功時は fieldCount と requestMs を記録する（画像・文字は含めない）", async () => {
    const jpeg = new Blob([new Uint8Array([7])], { type: "image/jpeg" });
    await startLabelRecognition(jpeg, async () => response);
    const metric = getRecentPhotoMetrics()[0];
    expect(metric).toMatchObject({ kind: "recognize", ok: true, fieldCount: 1 });
    expect(JSON.stringify(metric)).not.toContain("Test");
  });

  it("裏面が変わると同じ表面でも再リクエストし、裏面を run に渡す", async () => {
    const front = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    const back = new Blob([new Uint8Array([2])], { type: "image/jpeg" });
    const backs: Array<Blob | null | undefined> = [];
    const run = async (_jpeg: Blob, b?: Blob | null) => {
      backs.push(b);
      return response;
    };
    const first = startLabelRecognition(front, run);
    expect(startLabelRecognition(front, run)).toBe(first);
    const withBack = startLabelRecognition(front, run, { back });
    expect(withBack).not.toBe(first);
    expect(startLabelRecognition(front, run, { back })).toBe(withBack);
    await Promise.all([first, withBack]);
    expect(backs).toEqual([null, back]);
  });

  it("force は同じ組でも再リクエストする（再読み取り）", async () => {
    const jpeg = new Blob([new Uint8Array([4])], { type: "image/jpeg" });
    let calls = 0;
    const run = async () => {
      calls += 1;
      return response;
    };
    await startLabelRecognition(jpeg, run);
    await startLabelRecognition(jpeg, run, { force: true });
    expect(calls).toBe(2);
  });

  it("同時に走るのは LABEL_RECOGNIZE_CONCURRENCY まで。残りは順番待ち。中断された待ちは run しない", async () => {
    let active = 0;
    let peak = 0;
    const resolvers: Array<() => void> = [];
    const run = () =>
      new Promise<RecognizeResponse>((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        resolvers.push(() => {
          active -= 1;
          resolve(response);
        });
      });
    const blobs = [1, 2, 3, 4].map((n) => new Blob([new Uint8Array([n])], { type: "image/jpeg" }));
    const controller = new AbortController();
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const promises = blobs.map((blob, index) =>
      startLabelRecognition(blob, run, index === 3 ? { signal: controller.signal } : {}),
    );
    await flush();
    expect(active).toBe(LABEL_RECOGNIZE_CONCURRENCY);
    controller.abort();
    // 1 つ終わると 3 つ目が走る。4 つ目は中断済みなので順番が来ても run しない
    resolvers.shift()?.();
    await flush();
    expect(resolvers).toHaveLength(2);
    resolvers.shift()?.();
    await flush();
    resolvers.shift()?.();
    await flush();
    await Promise.all(promises.slice(0, 3));
    await expect(promises[3]).rejects.toBeInstanceOf(RecognitionCancelledError);
    expect(peak).toBe(LABEL_RECOGNIZE_CONCURRENCY);
    expect(resolvers).toHaveLength(0);
  });
});

describe("forgetAllRecognition", () => {
  it("3 機能の同じ Blob を捨てて再実行できる", async () => {
    const jpeg = new Blob([new Uint8Array([3])], { type: "image/jpeg" });
    let label = 0;
    let drink = 0;
    let note = 0;
    await startLabelRecognition(jpeg, async () => {
      label += 1;
      return response;
    });
    await startDrinkRecognition(jpeg, async () => {
      drink += 1;
      return {
        fields: {},
        provider: "gemini",
        remainingToday: 29,
        profile: "gemini-3.5-flash-lite",
        modelId: "test",
        durationMs: 1,
        usage: { inputTokens: null, outputTokens: null, thinkingTokens: null, searchCount: null },
        sources: [],
        searchUsed: false,
        lookupSuggested: false,
      };
    });
    await startNoteRecognition(jpeg, async () => {
      note += 1;
      return { fields: {}, provider: "workers-ai", remainingToday: 29 };
    });
    forgetAllRecognition(jpeg);
    await startLabelRecognition(jpeg, async () => {
      label += 1;
      return response;
    });
    expect(label).toBe(2);
    expect(drink).toBe(1);
    expect(note).toBe(1);
  });
});
