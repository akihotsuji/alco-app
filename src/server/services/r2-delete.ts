import { photoR2KeysToDelete } from "../lib/photo-thumb.ts";
import type { PhotoBucket } from "./photos.ts";

const NOT_FOUND_RE = /not[\s_-]?found|404|no such key|does not exist/i;

export function classifyR2DeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (NOT_FOUND_RE.test(message)) {
    return "not_found";
  }
  if (/timeout|timed out|abort/i.test(message)) {
    return "timeout";
  }
  if (/403|401|forbidden|unauthorized|access denied/i.test(message)) {
    return "forbidden";
  }
  if (/5\d\d|internal server|service unavailable/i.test(message)) {
    return "r2_5xx";
  }
  return "unknown";
}

/**
 * R2 delete。成功またはオブジェクト無しは成功。タイムアウト・5xx・権限は投げる。
 */
export async function deleteR2Object(bucket: PhotoBucket, key: string): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    if (classifyR2DeleteError(error) === "not_found") {
      return;
    }
    throw error;
  }
}

/** 原本とサムネ派生。どちらかがタイムアウト等なら投げ、D1 行は残す */
export async function deletePhotoR2Objects(bucket: PhotoBucket, r2Key: string): Promise<void> {
  const errors: unknown[] = [];
  for (const key of photoR2KeysToDelete(r2Key)) {
    try {
      await deleteR2Object(bucket, key);
    } catch (error) {
      errors.push(error);
    }
  }
  const first = errors[0];
  if (first !== undefined) {
    throw first;
  }
}
