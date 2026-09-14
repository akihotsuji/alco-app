import { describe, expect, it } from "vitest";
import { DEFAULT_PHOTO_CUTOUT_PROVIDER } from "@/shared/constants.ts";
import {
  resolveCutoutProviderPreference,
  shouldAttemptWebGpu,
  shouldFallbackToWasm,
} from "./cutout-provider.ts";

describe("resolveCutoutProviderPreference", () => {
  it("本番既定は wasm（比較未了の GPU を無条件既定にしない）", () => {
    expect(resolveCutoutProviderPreference()).toBe("wasm");
    expect(DEFAULT_PHOTO_CUTOUT_PROVIDER).toBe("wasm");
  });
});

describe("shouldAttemptWebGpu", () => {
  it("このセッションで GPU 障害が出たら再初期化しない", () => {
    expect(shouldAttemptWebGpu({ preference: "auto", gpuBlocked: true })).toBe(false);
    expect(shouldAttemptWebGpu({ preference: "webgpu", gpuBlocked: true })).toBe(false);
    expect(shouldAttemptWebGpu({ preference: "wasm", gpuBlocked: false })).toBe(false);
    expect(shouldAttemptWebGpu({ preference: "auto", gpuBlocked: false })).toBe(true);
  });
});

describe("shouldFallbackToWasm", () => {
  it("GPU の初期化・推論・device loss 相当は WASM へ 1 回", () => {
    expect(
      shouldFallbackToWasm({ attempted: "webgpu", reason: "session_init", aborted: false }),
    ).toBe(true);
    expect(shouldFallbackToWasm({ attempted: "webgpu", reason: "inference", aborted: false })).toBe(
      true,
    );
    expect(shouldFallbackToWasm({ attempted: "webgpu", reason: "timeout", aborted: false })).toBe(
      true,
    );
    expect(
      shouldFallbackToWasm({ attempted: "webgpu", reason: "invalid_output", aborted: false }),
    ).toBe(true);
    expect(shouldFallbackToWasm({ attempted: "webgpu", reason: "unknown", aborted: false })).toBe(
      true,
    );
  });

  it("取消・superseded・品質失敗では再試行しない", () => {
    expect(
      shouldFallbackToWasm({ attempted: "webgpu", reason: "superseded", aborted: false }),
    ).toBe(false);
    expect(shouldFallbackToWasm({ attempted: "webgpu", reason: "inference", aborted: true })).toBe(
      false,
    );
    expect(
      shouldFallbackToWasm({ attempted: "webgpu", reason: "empty_mask", aborted: false }),
    ).toBe(false);
    expect(
      shouldFallbackToWasm({ attempted: "webgpu", reason: "invalid_mask", aborted: false }),
    ).toBe(false);
    expect(shouldFallbackToWasm({ attempted: "wasm", reason: "inference", aborted: false })).toBe(
      false,
    );
  });
});
