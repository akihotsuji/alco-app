import type { RecognizeSource, TokenUsage } from "@/shared/ai-recognition.ts";
import type { LabelRecognizeProvider } from "@/shared/constants.ts";
import type {
  DrinkLookupFields,
  DrinkRecognizeFields,
  OriginCandidate,
} from "@/shared/drink-recognize.ts";

export type DrinkCacheValue = {
  fields: DrinkRecognizeFields;
  sources: RecognizeSource[];
  usage: TokenUsage;
  searchUsed: boolean;
  profile: string;
  modelId: string;
  provider: LabelRecognizeProvider;
  lookupSuggested: boolean;
  originCandidate: OriginCandidate | undefined;
  appellation: string | null;
};

export type DrinkLookupCacheValue = {
  fields: DrinkLookupFields;
  matched: boolean;
  sources: RecognizeSource[];
  usage: TokenUsage;
  searchUsed: boolean;
};

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 32;

type Entry = {
  value: unknown;
  expiresAt: number;
};

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

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

export function getCachedRecognition<T = DrinkCacheValue>(key: string): T | null {
  const entry = memory.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedRecognition<T>(key: string, value: T): void {
  if (memory.size >= MAX_ENTRIES) {
    const first = memory.keys().next().value;
    if (first) {
      memory.delete(first);
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function getInflightRecognition<T = DrinkCacheValue>(key: string): Promise<T> | null {
  return (inflight.get(key) as Promise<T> | undefined) ?? null;
}

export function setInflightRecognition<T>(key: string, promise: Promise<T>): void {
  inflight.set(key, promise);
  void promise
    .finally(() => {
      inflight.delete(key);
    })
    .catch(() => {
      // 呼び出し側が catch する。ここでは未処理拒否を残さない。
    });
}

export async function withRecognitionCache<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const cached = getCachedRecognition<T>(key);
  if (cached !== null) {
    return cached;
  }
  const pending = getInflightRecognition<T>(key);
  if (pending) {
    return pending;
  }
  const promise = compute();
  setInflightRecognition(key, promise);
  const value = await promise;
  setCachedRecognition(key, value);
  return value;
}

/** テスト用 */
export function clearRecognitionCache(): void {
  memory.clear();
  inflight.clear();
}
