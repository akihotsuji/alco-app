import type { InferenceSession } from "onnxruntime-web";
import {
  PHOTO_CUTOUT_CACHE,
  PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
  PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS,
  PHOTO_CUTOUT_MODEL_SIZE,
  PHOTO_CUTOUT_MODEL_URL,
  PHOTO_CUTOUT_ORT_WASM_PATH,
  PHOTO_CUTOUT_SHADOW,
} from "@/shared/constants.ts";
import {
  applyAlphaMask,
  flattenMaskOutput,
  maskHasSubject,
  normalizeU2NetMask,
  packU2NetTensor,
  raceWithTimeout,
} from "./cutout-mask.ts";
import { supportsWasmSimd } from "./filter-support.ts";
import { alphaBoundingBox, computeCutoutPlacement } from "./geometry.ts";

export type RemoveBackgroundProgress = {
  percent?: number;
  firstDownload: boolean;
};

let sessionPromise: Promise<InferenceSession> | null = null;
let runChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = runChain.then(work, work);
  runChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * SIMD が無い端末ではトグル非表示。モデル本体は使ったときだけ読む。
 * @imgly/background-removal は AGPL-3.0 のため使わない（仕様の Apache-2.0 前提）。
 */
export function supportsBackgroundRemoval(): boolean {
  return typeof WebAssembly !== "undefined" && supportsWasmSimd();
}

export async function removeBackground(
  source: CanvasImageSource,
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<HTMLCanvasElement> {
  const input = canvasFromSource(source);
  const session = await getSession(onProgress);
  const modelCanvas = resizeToModel(input, PHOTO_CUTOUT_MODEL_SIZE);
  const modelCtx = modelCanvas.getContext("2d");
  if (!modelCtx) {
    throw new Error("canvas 2d が使えません");
  }
  const packed = packU2NetTensor(
    modelCtx.getImageData(0, 0, PHOTO_CUTOUT_MODEL_SIZE, PHOTO_CUTOUT_MODEL_SIZE).data,
  );
  const ort = await loadOrt();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new Error("cutout_model");
  }
  const results = await enqueue(() =>
    raceWithTimeout(
      session.run({
        [inputName]: new ort.Tensor("float32", packed, [
          1,
          3,
          PHOTO_CUTOUT_MODEL_SIZE,
          PHOTO_CUTOUT_MODEL_SIZE,
        ]),
      }),
      PHOTO_CUTOUT_INFERENCE_TIMEOUT_MS,
    ),
  );
  const output = results[outputName];
  if (!output || !(output.data instanceof Float32Array)) {
    throw new Error("cutout_output");
  }
  const mask = normalizeU2NetMask(flattenMaskOutput(output.data));
  if (!maskHasSubject(mask)) {
    throw new Error("cutout_empty");
  }
  const scaled = scaleMask(mask, PHOTO_CUTOUT_MODEL_SIZE, input.width, input.height);
  const out = document.createElement("canvas");
  out.width = input.width;
  out.height = input.height;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    throw new Error("canvas 2d が使えません");
  }
  outCtx.drawImage(input, 0, 0);
  const image = outCtx.getImageData(0, 0, out.width, out.height);
  applyAlphaMask(image.data, scaled);
  outCtx.putImageData(image, 0, 0);
  return out;
}

export function paintCutoutOnCanvas(
  cutout: HTMLCanvasElement,
  dest: HTMLCanvasElement,
): HTMLCanvasElement {
  const srcCtx = cutout.getContext("2d");
  const destCtx = dest.getContext("2d");
  if (!srcCtx || !destCtx) {
    throw new Error("canvas 2d が使えません");
  }
  const image = srcCtx.getImageData(0, 0, cutout.width, cutout.height);
  const box = alphaBoundingBox(image.data, cutout.width, cutout.height) ?? {
    x: 0,
    y: 0,
    width: cutout.width,
    height: cutout.height,
  };
  const placed = computeCutoutPlacement({
    sourceWidth: box.width,
    sourceHeight: box.height,
    canvasWidth: dest.width,
    canvasHeight: dest.height,
  });
  destCtx.clearRect(0, 0, dest.width, dest.height);
  destCtx.fillStyle = PHOTO_CUTOUT_SHADOW.color;
  destCtx.beginPath();
  destCtx.ellipse(
    placed.shadow.x,
    placed.shadow.y,
    placed.shadow.rx,
    placed.shadow.ry,
    0,
    0,
    Math.PI * 2,
  );
  destCtx.fill();
  destCtx.drawImage(
    cutout,
    box.x,
    box.y,
    box.width,
    box.height,
    placed.x,
    placed.y,
    placed.width,
    placed.height,
  );
  return dest;
}

async function getSession(
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = createSession(onProgress).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

async function createSession(
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<InferenceSession> {
  const ort = await loadOrt();
  const bytes = await loadModelBytes(onProgress);
  return raceWithTimeout(ort.InferenceSession.create(bytes), PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS);
}

async function loadOrt(): Promise<typeof import("onnxruntime-web")> {
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = PHOTO_CUTOUT_ORT_WASM_PATH;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  return ort;
}

async function loadModelBytes(
  onProgress?: (progress: RemoveBackgroundProgress) => void,
): Promise<ArrayBuffer> {
  const cache = "caches" in globalThis ? await caches.open(PHOTO_CUTOUT_CACHE) : null;
  const cached = cache ? await cache.match(PHOTO_CUTOUT_MODEL_URL) : undefined;
  if (cached) {
    onProgress?.({ firstDownload: false, percent: 100 });
    return cached.arrayBuffer();
  }
  onProgress?.({ firstDownload: true, percent: 0 });
  const response = await raceWithTimeout(
    fetch(PHOTO_CUTOUT_MODEL_URL),
    PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error("cutout_model_fetch");
  }
  const total = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    await putModelCache(cache, buffer);
    onProgress?.({ firstDownload: true, percent: 100 });
    return buffer;
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
        onProgress?.({ firstDownload: true, percent: Math.round((received / total) * 100) });
      }
    }
  }
  const buffer = concatBytes(chunks);
  await putModelCache(cache, buffer);
  onProgress?.({ firstDownload: true, percent: 100 });
  return buffer;
}

async function putModelCache(cache: Cache | null, buffer: ArrayBuffer): Promise<void> {
  if (!cache) {
    return;
  }
  await cache.put(
    PHOTO_CUTOUT_MODEL_URL,
    new Response(buffer, { headers: { "Content-Type": "application/octet-stream" } }),
  );
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

function canvasFromSource(source: CanvasImageSource): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) {
    return source;
  }
  const width = sourceWidth(source);
  const height = sourceHeight(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function sourceWidth(source: CanvasImageSource): number {
  if ("width" in source && typeof source.width === "number") {
    return source.width;
  }
  if ("displayWidth" in source && typeof source.displayWidth === "number") {
    return source.displayWidth;
  }
  return 0;
}

function sourceHeight(source: CanvasImageSource): number {
  if ("height" in source && typeof source.height === "number") {
    return source.height;
  }
  if ("displayHeight" in source && typeof source.displayHeight === "number") {
    return source.displayHeight;
  }
  return 0;
}

function resizeToModel(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d が使えません");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  return canvas;
}

function scaleMask(mask: Uint8Array, modelSize: number, width: number, height: number): Uint8Array {
  const src = document.createElement("canvas");
  src.width = modelSize;
  src.height = modelSize;
  const srcCtx = src.getContext("2d");
  if (!srcCtx) {
    throw new Error("canvas 2d が使えません");
  }
  const image = srcCtx.createImageData(modelSize, modelSize);
  for (let i = 0; i < modelSize * modelSize; i += 1) {
    const value = mask[i] ?? 0;
    const offset = i * 4;
    image.data[offset] = value;
    image.data[offset + 1] = value;
    image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  srcCtx.putImageData(image, 0, 0);
  const dest = document.createElement("canvas");
  dest.width = width;
  dest.height = height;
  const destCtx = dest.getContext("2d");
  if (!destCtx) {
    throw new Error("canvas 2d が使えません");
  }
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = "high";
  destCtx.drawImage(src, 0, 0, width, height);
  const scaled = destCtx.getImageData(0, 0, width, height);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = scaled.data[i * 4] ?? 0;
  }
  return out;
}
