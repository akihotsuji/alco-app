import type { InferenceSession, Tensor } from "onnxruntime-web";
import {
  PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
  PHOTO_CUTOUT_MODEL_SIZE,
  PHOTO_CUTOUT_ORT_JSEP_MJS_FILE,
  PHOTO_CUTOUT_ORT_JSEP_WASM_FILE,
  PHOTO_CUTOUT_ORT_MJS_FILE,
  PHOTO_CUTOUT_ORT_WASM_FILE,
  PHOTO_CUTOUT_ORT_WASM_PATH,
} from "@/shared/constants.ts";
import { raceWithTimeout } from "./cutout-mask.ts";
import { loadCutoutModelBytes, type ModelDownloadProgress } from "./cutout-model-cache.ts";
import type { CutoutExecProvider } from "./cutout-provider.ts";
import { CutoutError, type CutoutTiming, emptyCutoutTiming } from "./cutout-result.ts";

export type OrtModule = typeof import("onnxruntime-web");
export type OrtTensor = Tensor;
export type OrtSession = InferenceSession;

export type SessionTiming = Pick<CutoutTiming, "modelDownloadMs" | "ortLoadMs" | "sessionCreateMs">;

export type LoadedRuntime = {
  provider: CutoutExecProvider;
  ort: OrtModule;
  session: OrtSession;
  timing: SessionTiming;
};

type OrtAssetKind = "wasm" | "jsep";

let inflight: Promise<LoadedRuntime> | null = null;
let ready: LoadedRuntime | null = null;
let gpuBlocked = false;
let creatingProvider: CutoutExecProvider | null = null;

export function isGpuBlockedThisSession(): boolean {
  return gpuBlocked;
}

export function blockGpuThisSession(): void {
  gpuBlocked = true;
}

export function resetCutoutRuntimeForTests(): void {
  inflight = null;
  ready = null;
  gpuBlocked = false;
  creatingProvider = null;
}

export function resolveOrtWasmPaths(
  origin = "",
  kind: OrtAssetKind = "wasm",
): { mjs: string; wasm: string } {
  const prefix = origin.replace(/\/$/, "");
  const directory = `${prefix}${PHOTO_CUTOUT_ORT_WASM_PATH}`;
  if (kind === "jsep") {
    return {
      mjs: `${directory}${PHOTO_CUTOUT_ORT_JSEP_MJS_FILE}`,
      wasm: `${directory}${PHOTO_CUTOUT_ORT_JSEP_WASM_FILE}`,
    };
  }
  return {
    mjs: `${directory}${PHOTO_CUTOUT_ORT_MJS_FILE}`,
    wasm: `${directory}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
  };
}

function configureWasm(ort: OrtModule, kind: OrtAssetKind): void {
  ort.env.wasm.wasmPaths = resolveOrtWasmPaths(globalThis.location?.origin ?? "", kind);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
}

async function loadOrtModule(provider: CutoutExecProvider): Promise<OrtModule> {
  if (provider === "webgpu") {
    const ort = await import("onnxruntime-web/webgpu");
    configureWasm(ort, "jsep");
    return ort;
  }
  const ort = await import("onnxruntime-web/wasm");
  configureWasm(ort, "wasm");
  return ort;
}

function watchGpuLoss(ort: OrtModule): void {
  const lost = ort.env.webgpu?.device?.lost;
  if (!lost || typeof lost.then !== "function") {
    return;
  }
  void lost.then(() => {
    gpuBlocked = true;
    if (ready?.provider === "webgpu") {
      void releaseCutoutRuntime();
    }
  });
}

async function probeGpuSession(ort: OrtModule, session: OrtSession): Promise<void> {
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName) {
    throw new CutoutError("session_init", "webgpu io names");
  }
  const packed = new Float32Array(3 * PHOTO_CUTOUT_MODEL_SIZE * PHOTO_CUTOUT_MODEL_SIZE);
  const outputs = await session.run({
    [inputName]: new ort.Tensor("float32", packed, [1, 3, PHOTO_CUTOUT_MODEL_SIZE, PHOTO_CUTOUT_MODEL_SIZE]),
  });
  const output = outputs[outputName];
  if (!output) {
    throw new CutoutError("session_init", "webgpu probe");
  }
  try {
    await readTensorFloat32(output);
  } finally {
    output.dispose?.();
  }
}

async function createRuntime(
  provider: CutoutExecProvider,
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<LoadedRuntime> {
  const timing: SessionTiming = emptyCutoutTiming();
  const ortStart = performance.now();
  const ort = await loadOrtModule(provider).catch((error: unknown) => {
    throw new CutoutError("session_init", `${provider} ort load`, { cause: error });
  });
  timing.ortLoadMs = elapsed(ortStart);

  const downloadStart = performance.now();
  const bytes = await loadCutoutModelBytes(onProgress).catch((error: unknown) => {
    throw error instanceof CutoutError
      ? error
      : new CutoutError("model_download", undefined, { cause: error });
  });
  timing.modelDownloadMs = elapsed(downloadStart);

  const createStart = performance.now();
  try {
    const session = await raceWithTimeout(
      provider === "webgpu"
        ? ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"] })
        : ort.InferenceSession.create(bytes),
      PHOTO_CUTOUT_DOWNLOAD_TIMEOUT_MS,
    );
    if (provider === "webgpu") {
      await probeGpuSession(ort, session);
      watchGpuLoss(ort);
    }
    timing.sessionCreateMs = elapsed(createStart);
    return { provider, ort, session, timing };
  } catch (error) {
    throw error instanceof CutoutError
      ? error
      : new CutoutError("session_init", `${provider} session`, { cause: error });
  }
}

export async function releaseCutoutRuntime(): Promise<void> {
  const current = ready;
  ready = null;
  inflight = null;
  creatingProvider = null;
  if (!current) {
    return;
  }
  try {
    await current.session.release?.();
  } catch {
    // 破棄失敗でも次のセッション作成へ進む
  }
}

export async function getCutoutRuntime(input: {
  provider: CutoutExecProvider;
  onProgress?: (progress: ModelDownloadProgress) => void;
}): Promise<LoadedRuntime> {
  if (input.provider === "webgpu" && gpuBlocked) {
    throw new CutoutError("session_init", "webgpu blocked");
  }
  if (ready && ready.provider === input.provider) {
    return {
      provider: ready.provider,
      ort: ready.ort,
      session: ready.session,
      timing: { modelDownloadMs: 0, ortLoadMs: 0, sessionCreateMs: 0 },
    };
  }
  if (ready && ready.provider !== input.provider) {
    await releaseCutoutRuntime();
  }
  if (inflight && creatingProvider === input.provider) {
    return inflight;
  }
  if (inflight) {
    await inflight.catch(() => undefined);
    return getCutoutRuntime(input);
  }
  creatingProvider = input.provider;
  inflight = createRuntime(input.provider, input.onProgress).then(
    (loaded) => {
      ready = loaded;
      return loaded;
    },
    (error: unknown) => {
      inflight = null;
      creatingProvider = null;
      throw error;
    },
  );
  return inflight;
}

export async function readTensorFloat32(tensor: OrtTensor): Promise<Float32Array> {
  if (tensor.data instanceof Float32Array) {
    return tensor.data;
  }
  const downloaded = await tensor.getData?.();
  if (downloaded instanceof Float32Array) {
    return downloaded;
  }
  throw new CutoutError("invalid_output", "output tensor");
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}
