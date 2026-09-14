import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/client/lib/api.ts";
import { PhotoDecodeError } from "@/client/lib/photo/decode-image.ts";
import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";
import { createTaskQueue } from "@/client/lib/photo/task-queue.ts";
import {
  acceptFilesForBatch,
  BATCH_UPLOAD_CONCURRENCY,
  runBatchPhotoJobs,
} from "./bottle-batch-pipeline.ts";

function files(count: number): File[] {
  return Array.from({ length: count }, (_, index) => new File([], `p${index}.jpg`));
}

function processed(label: string): ProcessedPhoto {
  return {
    blob: new Blob([label], { type: "image/jpeg" }),
    previewUrl: `blob:${label}`,
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("acceptFilesForBatch", () => {
  it("5・10・20 枚は欠落せず受け付ける", () => {
    expect(acceptFilesForBatch(files(5), 20).taken).toHaveLength(5);
    expect(acceptFilesForBatch(files(10), 20).taken).toHaveLength(10);
    expect(acceptFilesForBatch(files(20), 20).taken).toHaveLength(20);
    expect(acceptFilesForBatch(files(20), 20).overflow).toBe(0);
  });

  it("21 枚以上は上限超過を数え、20 を超えない", () => {
    expect(acceptFilesForBatch(files(21), 20)).toEqual({
      taken: files(21).slice(0, 20),
      overflow: 1,
      picked: 21,
    });
  });

  it("既存行がある残り枠でも上限を守る", () => {
    expect(acceptFilesForBatch(files(5), 3)).toMatchObject({
      overflow: 2,
      picked: 5,
    });
    expect(acceptFilesForBatch(files(5), 3).taken).toHaveLength(3);
    expect(acceptFilesForBatch(files(4), 0)).toEqual({ taken: [], overflow: 4, picked: 4 });
  });
});

describe("runBatchPhotoJobs", () => {
  it("10枚・20枚でも受け付けたキーが欠落しない", async () => {
    for (const count of [10, 20]) {
      const done: string[] = [];
      await runBatchPhotoJobs(
        files(count).map((file, index) => ({
          key: `k${index}`,
          ingestId: `ing-${index}`,
          file,
        })),
        {
          isActive: () => true,
          convert: async (job) => processed(job.key),
          upload: async (job) => {
            done.push(job.key);
            return { id: job.key };
          },
        },
      );
      expect(done).toHaveLength(count);
    }
  });

  it("受け付けた写真は変換失敗しても行キーが残る。後続は進む", async () => {
    const events: string[] = [];
    const active = new Set(["a", "b", "c", "d", "e"]);
    await runBatchPhotoJobs(
      files(5).map((file, index) => ({
        key: "abcde"[index] ?? "x",
        ingestId: `ing-${index}`,
        file,
      })),
      {
        isActive: (key) => active.has(key),
        convert: async (job) => {
          if (job.key === "d") {
            throw new PhotoDecodeError();
          }
          return processed(job.key);
        },
        upload: async (job) => ({ id: `photo-${job.key}` }),
        onConvertError: (key) => events.push(`convert-error:${key}`),
        onUploadDone: (key) => events.push(`upload:${key}`),
      },
    );
    expect(events).toContain("convert-error:d");
    expect(events.filter((item) => item.startsWith("upload:"))).toEqual([
      "upload:a",
      "upload:b",
      "upload:c",
      "upload:e",
    ]);
  });

  it("アップロード同時数は 2 を超えず、失敗後も待機列が進む", async () => {
    let activeUploads = 0;
    let peak = 0;
    const seen: string[] = [];
    await runBatchPhotoJobs(
      files(6).map((file, index) => ({
        key: `k${index}`,
        ingestId: `ing-${index}`,
        file,
      })),
      {
        isActive: () => true,
        convert: async (job) => processed(job.key),
        upload: async (job) => {
          activeUploads += 1;
          peak = Math.max(peak, activeUploads);
          await flush();
          activeUploads -= 1;
          if (job.key === "k3") {
            throw new ApiClientError(503, "internal_error");
          }
          seen.push(job.key);
          return { id: job.key };
        },
      },
    );
    expect(peak).toBeLessThanOrEqual(BATCH_UPLOAD_CONCURRENCY);
    expect(seen).toEqual(["k0", "k1", "k2", "k4", "k5"]);
  });

  it.each([
    ["convert", () => new PhotoDecodeError()],
    ["413", () => new ApiClientError(413, "payload_too_large")],
    ["429", () => new ApiClientError(429, "rate_limited")],
    ["5xx", () => new ApiClientError(503, "internal_error")],
    ["network", () => new TypeError("Failed to fetch")],
  ] as const)("4 枚目に %s を注入しても後続は処理される", async (_name, makeError) => {
    const done: string[] = [];
    const failed: string[] = [];
    await runBatchPhotoJobs(
      files(6).map((file, index) => ({
        key: `k${index}`,
        ingestId: `ing-${index}`,
        file,
      })),
      {
        isActive: () => true,
        convert: async (job) => {
          if (job.key === "k3" && _name === "convert") {
            throw makeError();
          }
          return processed(job.key);
        },
        upload: async (job) => {
          if (job.key === "k3" && _name !== "convert") {
            throw makeError();
          }
          done.push(job.key);
          return { id: job.key };
        },
        onConvertError: (key) => failed.push(key),
        onUploadError: (key) => failed.push(key),
      },
    );
    expect(failed).toEqual(["k3"]);
    expect(done).toEqual(["k0", "k1", "k2", "k4", "k5"]);
  });

  it("行を外したあとの遅延結果は反映しない", async () => {
    const active = new Set(["keep", "gone"]);
    const uploaded: string[] = [];
    const convertGate = new Map<string, () => void>();
    const jobs = [
      { key: "keep", ingestId: "ing-keep", file: files(1)[0] as File },
      { key: "gone", ingestId: "ing-gone", file: files(2)[1] as File },
    ];
    const running = runBatchPhotoJobs(jobs, {
      isActive: (key) => active.has(key),
      convert: (job) =>
        new Promise((resolve) => {
          convertGate.set(job.key, () => resolve(processed(job.key)));
        }),
      upload: async (job) => {
        uploaded.push(job.key);
        return { id: job.key };
      },
      convertQueue: createTaskQueue(1),
      uploadQueue: createTaskQueue(2),
    });
    await flush();
    active.delete("gone");
    convertGate.get("keep")?.();
    convertGate.get("gone")?.();
    await running;
    expect(uploaded).toEqual(["keep"]);
  });
});
