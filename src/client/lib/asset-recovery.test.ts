import { describe, expect, it, vi } from "vitest";
import {
  decideAssetRecovery,
  isChunkLoadError,
  recoverFromAssetFailure,
} from "./asset-recovery.ts";
import { ASSET_RECOVERY_STORAGE_KEY } from "./boot.ts";

describe("decideAssetRecovery", () => {
  it("オフラインと繰り返し失敗は UI、初回のオンライン失敗だけ reload", () => {
    expect(decideAssetRecovery({ online: false, alreadyReloaded: false })).toBe("ui-offline");
    expect(decideAssetRecovery({ online: true, alreadyReloaded: true })).toBe("ui-repeat");
    expect(decideAssetRecovery({ online: true, alreadyReloaded: false })).toBe("reload");
  });
});

describe("isChunkLoadError", () => {
  it("動的 import 失敗を検出する", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS"))).toBe(true);
    expect(isChunkLoadError(new Error("boom"))).toBe(false);
  });
});

describe("recoverFromAssetFailure", () => {
  it("初回は reload 印を残す", () => {
    const storage = new Map<string, string>();
    const reload = vi.fn();
    const decision = recoverFromAssetFailure({
      online: true,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
      },
      reload,
    });
    expect(decision).toBe("reload");
    expect(storage.get(ASSET_RECOVERY_STORAGE_KEY)).toBe("1");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("2 回目は UI に倒す", () => {
    const reload = vi.fn();
    const decision = recoverFromAssetFailure({
      online: true,
      storage: {
        getItem: () => "1",
        setItem: () => undefined,
      },
      reload,
    });
    expect(decision).toBe("ui-repeat");
    expect(reload).not.toHaveBeenCalled();
  });
});
