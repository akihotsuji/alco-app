import {
  DEFAULT_PHOTO_CUTOUT_PROVIDER,
  PHOTO_CUTOUT_COMPARE_KEY,
  PHOTO_CUTOUT_PROVIDER_KEY,
  PHOTO_CUTOUT_PROVIDERS,
  type PhotoCutoutProviderPref,
} from "@/shared/constants.ts";
import type { CutoutFailureReason } from "./cutout-result.ts";

export type CutoutExecProvider = "wasm" | "webgpu";

type GpuApi = {
  requestAdapter: () => Promise<unknown>;
};

function isProviderPref(value: string | null): value is PhotoCutoutProviderPref {
  return value !== null && (PHOTO_CUTOUT_PROVIDERS as readonly string[]).includes(value);
}

function readSearchProvider(): PhotoCutoutProviderPref | null {
  if (!import.meta.env.DEV || typeof location === "undefined") {
    return null;
  }
  try {
    const value = new URLSearchParams(location.search).get("cutoutProvider");
    return isProviderPref(value) ? value : null;
  } catch {
    return null;
  }
}

function readStoredProvider(): PhotoCutoutProviderPref | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const value = sessionStorage.getItem(PHOTO_CUTOUT_PROVIDER_KEY);
    return isProviderPref(value) ? value : null;
  } catch {
    return null;
  }
}

/** 本番既定は wasm。開発時だけ query / sessionStorage で webgpu|auto に切り替えられる */
export function resolveCutoutProviderPreference(): PhotoCutoutProviderPref {
  return readSearchProvider() ?? readStoredProvider() ?? DEFAULT_PHOTO_CUTOUT_PROVIDER;
}

export function isCutoutCompareMode(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  try {
    return sessionStorage.getItem(PHOTO_CUTOUT_COMPARE_KEY) === "1";
  } catch {
    return false;
  }
}

function isGpuApi(value: unknown): value is GpuApi {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof Reflect.get(value, "requestAdapter") === "function";
}

/** `navigator.gpu` の存在だけでは対応としない。adapter 取得まで見る */
export async function probeWebGpuAdapter(): Promise<boolean> {
  if (typeof navigator === "undefined") {
    return false;
  }
  const gpu = Reflect.get(navigator, "gpu");
  if (!isGpuApi(gpu)) {
    return false;
  }
  try {
    const adapter = await gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export function hasWebGpuApi(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return isGpuApi(Reflect.get(navigator, "gpu"));
}

export function shouldAttemptWebGpu(input: {
  preference: PhotoCutoutProviderPref;
  gpuBlocked: boolean;
}): boolean {
  if (input.gpuBlocked) {
    return false;
  }
  return input.preference === "webgpu" || input.preference === "auto";
}

const FALLBACK_REASONS: readonly CutoutFailureReason[] = [
  "session_init",
  "inference",
  "timeout",
  "invalid_output",
  "unknown",
];

/**
 * GPU 失敗から WASM へ最大 1 回。取消・superseded・品質判定失敗では再試行しない。
 */
export function shouldFallbackToWasm(input: {
  attempted: CutoutExecProvider;
  reason: CutoutFailureReason;
  aborted: boolean;
}): boolean {
  if (input.attempted !== "webgpu" || input.aborted) {
    return false;
  }
  return FALLBACK_REASONS.includes(input.reason);
}
