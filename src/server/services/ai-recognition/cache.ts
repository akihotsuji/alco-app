import type { RecognizeSource, TokenUsage } from "@/shared/ai-recognition.ts";
import type { LabelRecognizeProvider } from "@/shared/constants.ts";
import type { DrinkRecognizeFields } from "@/shared/drink-recognize.ts";

export type DrinkCacheValue = {
  fields: DrinkRecognizeFields;
  sources: RecognizeSource[];
  usage: TokenUsage;
  searchUsed: boolean;
  profile: string;
  modelId: string;
  provider: LabelRecognizeProvider;
};

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 32;

type Entry = {
  value: DrinkCacheValue;
  expiresAt: number;
};

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<DrinkCacheValue>>();

export function recognitionCacheKey(parts: {
  userId: string;
  imageHash: string;
  profile: string;
  modelId: string;
  promptVersion: string;
  schemaVersion: string;
  searchEnabled: boolean;
}): string {
  return [
    parts.userId,
    parts.imageHash,
    parts.profile,
    parts.modelId,
    parts.promptVersion,
    parts.schemaVersion,
    parts.searchEnabled ? "search" : "nosearch",
  ].join("|");
}

export function getCachedRecognition(key: string): DrinkCacheValue | null {
  const entry = memory.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedRecognition(key: string, value: DrinkCacheValue): void {
  if (memory.size >= MAX_ENTRIES) {
    const first = memory.keys().next().value;
    if (first) {
      memory.delete(first);
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function getInflightRecognition(key: string): Promise<DrinkCacheValue> | null {
  return inflight.get(key) ?? null;
}

export function setInflightRecognition(key: string, promise: Promise<DrinkCacheValue>): void {
  inflight.set(key, promise);
  void promise
    .finally(() => {
      inflight.delete(key);
    })
    .catch(() => {
      // 呼び出し側が catch する。ここでは未処理拒否を残さない。
    });
}

/** テスト用 */
export function clearRecognitionCache(): void {
  memory.clear();
  inflight.clear();
}
