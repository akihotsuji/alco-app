import {
  PHOTO_CUTOUT_CACHE,
  PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
  PHOTO_CUTOUT_MODEL_URL,
} from "@/shared/constants.ts";
import { inspectCutoutModelBytes } from "@/shared/cutout-model.ts";
import { raceWithTimeout } from "./cutout-mask.ts";
import { CutoutError } from "./cutout-result.ts";

export type ModelDownloadProgress = {
  percent?: number;
  firstDownload: boolean;
};

export async function loadCutoutModelBytes(
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<ArrayBuffer> {
  const cache = await openModelCache();
  const cached = await readModelCache(cache);
  if (cached) {
    const cachedInspection = await inspectCutoutModelBytes(cached);
    if (cachedInspection.ok) {
      onProgress?.({ firstDownload: false, percent: 100 });
      return cached;
    }
    await deleteModelCache(cache);
  }
  onProgress?.({ firstDownload: true, percent: 0 });
  const buffer = await downloadModelBytes(onProgress);
  const inspection = await inspectCutoutModelBytes(buffer);
  if (!inspection.ok) {
    throw new CutoutError("model_download", `invalid model: ${inspection.reason}`);
  }
  await putModelCache(cache, buffer);
  onProgress?.({ firstDownload: true, percent: 100 });
  return buffer;
}

async function downloadModelBytes(
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<ArrayBuffer> {
  try {
    return await raceWithTimeout(
      (async () => {
        const response = await fetch(PHOTO_CUTOUT_MODEL_URL);
        if (!response.ok) {
          throw new CutoutError("model_download", `http ${response.status}`);
        }
        const total = Number(response.headers.get("content-length") ?? 0);
        const reader = response.body?.getReader();
        if (!reader) {
          return response.arrayBuffer();
        }
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const read = await reader.read();
          if (read.done) {
            break;
          }
          if (read.value) {
            chunks.push(read.value);
            received += read.value.byteLength;
            if (total > 0) {
              onProgress?.({
                firstDownload: true,
                percent: Math.round((received / total) * 100),
              });
            }
          }
        }
        return concatBytes(chunks);
      })(),
      PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
    );
  } catch (error) {
    throw error instanceof CutoutError
      ? error
      : new CutoutError("model_download", "fetch", { cause: error });
  }
}

export async function openModelCache(): Promise<Cache | null> {
  if (!("caches" in globalThis)) {
    return null;
  }
  try {
    return await caches.open(PHOTO_CUTOUT_CACHE);
  } catch {
    return null;
  }
}

async function readModelCache(cache: Cache | null): Promise<ArrayBuffer | null> {
  if (!cache) {
    return null;
  }
  try {
    const cached = await cache.match(PHOTO_CUTOUT_MODEL_URL);
    return cached ? await cached.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function deleteModelCache(cache: Cache | null): Promise<void> {
  if (!cache) {
    return;
  }
  try {
    await cache.delete(PHOTO_CUTOUT_MODEL_URL);
  } catch {
    // 不正エントリの削除に失敗してもネットワーク取得へ進む
  }
}

export async function putModelCache(cache: Cache | null, buffer: ArrayBuffer): Promise<void> {
  if (!cache) {
    return;
  }
  try {
    await cache.put(
      PHOTO_CUTOUT_MODEL_URL,
      new Response(buffer, { headers: { "Content-Type": "application/octet-stream" } }),
    );
  } catch {
    // キャッシュは最適化。書き込み失敗でも取得済みデータで続ける
  }
}

function concatBytes(chunks: Uint8Array[]): ArrayBuffer {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}
