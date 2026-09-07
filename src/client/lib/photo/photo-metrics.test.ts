import { afterEach, describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_DIAG_KEY } from "@/shared/constants.ts";
import { emptyCutoutTiming } from "./cutout-result.ts";
import { clearPhotoMetrics, getLastCutoutDiagnostic, recordCutoutMetric } from "./photo-metrics.ts";

const store = new Map<string, string>();

describe("recordCutoutMetric", () => {
  afterEach(() => {
    clearPhotoMetrics();
    store.clear();
  });

  it("本番でも sessionStorage に直近の切り抜き診断を残す", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });

    recordCutoutMetric("preview", {
      status: "failed",
      reason: "session_init",
      detail: "ort load",
      causeName: "TypeError",
      causeMessage: "Failed to fetch dynamically imported module",
      timing: emptyCutoutTiming(),
    });

    const saved = getLastCutoutDiagnostic();
    expect(saved?.outcome).toMatchObject({
      status: "failed",
      reason: "session_init",
      causeName: "TypeError",
    });
    expect(store.get(PHOTO_CUTOUT_DIAG_KEY)).toContain("session_init");
    expect(store.get(PHOTO_CUTOUT_DIAG_KEY)).not.toContain("cookie=");
  });
});
