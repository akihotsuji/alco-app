import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";
import {
  createTaskQueue,
  type TaskQueue,
  TaskQueueCancelledError,
} from "@/client/lib/photo/task-queue.ts";
import { isCancelledFailure } from "./bottle-batch-failure.ts";

export const BATCH_CONVERT_CONCURRENCY = 1;
export const BATCH_UPLOAD_CONCURRENCY = 2;
export const BATCH_TRANSIENT_RETRY_LIMIT = 2;

export type BatchPhotoJob = {
  key: string;
  ingestId: string;
  file: File;
};

export type BatchJobHooks = {
  convert: (job: BatchPhotoJob) => Promise<ProcessedPhoto>;
  upload: (job: { key: string; ingestId: string; blob: Blob }) => Promise<{ id: string }>;
  isActive: (key: string) => boolean;
  onConvertStart?: (key: string) => void;
  onConvertDone?: (key: string, processed: ProcessedPhoto) => void;
  onConvertError?: (key: string, error: unknown) => void;
  onUploadStart?: (key: string) => void;
  onUploadDone?: (key: string, photoId: string) => void;
  onUploadError?: (key: string, error: unknown) => void;
  convertQueue?: TaskQueue;
  uploadQueue?: TaskQueue;
};

export function acceptFilesForBatch(
  files: readonly File[],
  remaining: number,
): { taken: File[]; overflow: number; picked: number } {
  const picked = files.length;
  if (remaining <= 0) {
    return { taken: [], overflow: picked, picked };
  }
  const taken = files.slice(0, remaining);
  return { taken, overflow: picked - taken.length, picked };
}

export async function runBatchPhotoJobs(
  jobs: readonly BatchPhotoJob[],
  hooks: BatchJobHooks,
): Promise<void> {
  const convertQueue = hooks.convertQueue ?? createTaskQueue(BATCH_CONVERT_CONCURRENCY);
  const uploadQueue = hooks.uploadQueue ?? createTaskQueue(BATCH_UPLOAD_CONCURRENCY);
  await Promise.all(jobs.map((job) => runOneJob(job, { ...hooks, convertQueue, uploadQueue })));
}

export async function runBatchUploadJob(
  job: { key: string; ingestId: string; blob: Blob },
  hooks: Pick<
    BatchJobHooks,
    "upload" | "isActive" | "onUploadStart" | "onUploadDone" | "onUploadError" | "uploadQueue"
  >,
): Promise<void> {
  const uploadQueue = hooks.uploadQueue ?? createTaskQueue(BATCH_UPLOAD_CONCURRENCY);
  hooks.onUploadStart?.(job.key);
  try {
    const meta = await uploadQueue.run(async () => {
      if (!hooks.isActive(job.key)) {
        throw new TaskQueueCancelledError();
      }
      return hooks.upload(job);
    });
    if (!hooks.isActive(job.key)) {
      return;
    }
    hooks.onUploadDone?.(job.key, meta.id);
  } catch (error) {
    if (isCancelledFailure(error) || !hooks.isActive(job.key)) {
      return;
    }
    hooks.onUploadError?.(job.key, error);
  }
}

async function runOneJob(
  job: BatchPhotoJob,
  hooks: BatchJobHooks & { convertQueue: TaskQueue; uploadQueue: TaskQueue },
) {
  if (!hooks.isActive(job.key)) {
    return;
  }
  hooks.onConvertStart?.(job.key);
  let processed: ProcessedPhoto;
  try {
    processed = await hooks.convertQueue.run(async () => {
      if (!hooks.isActive(job.key)) {
        throw new TaskQueueCancelledError();
      }
      return hooks.convert(job);
    });
  } catch (error) {
    if (isCancelledFailure(error) || !hooks.isActive(job.key)) {
      return;
    }
    hooks.onConvertError?.(job.key, error);
    return;
  }
  if (!hooks.isActive(job.key)) {
    if (processed.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(processed.previewUrl);
    }
    return;
  }
  hooks.onConvertDone?.(job.key, processed);
  await runBatchUploadJob({ key: job.key, ingestId: job.ingestId, blob: processed.blob }, hooks);
}
