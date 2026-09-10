import { beforeEach, describe, expect, it } from "vitest";
import type { RecognizeResponse } from "@/shared/label-recognize.ts";
import { clearPhotoMetrics, getRecentPhotoMetrics } from "./photo/photo-metrics.ts";
import {
  forgetAllRecognition,
  forgetLabelRecognition,
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
        profile: "gemini-3.7-flash",
        modelId: "test",
        durationMs: 1,
        usage: { inputTokens: null, outputTokens: null, thinkingTokens: null, searchCount: null },
        sources: [],
        searchUsed: false,
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
