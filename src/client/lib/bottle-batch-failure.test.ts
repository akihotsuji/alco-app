import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/client/lib/api.ts";
import { PhotoDecodeError } from "@/client/lib/photo/decode-image.ts";
import { PhotoSizeError } from "@/client/lib/photo/to-jpeg-blob.ts";
import {
  classifyBatchFailure,
  isTransientHttpFailure,
  retryTransient,
} from "./bottle-batch-failure.ts";

describe("classifyBatchFailure", () => {
  it("読み込み・変換・容量・通信・認証・形式を区別する", () => {
    expect(classifyBatchFailure(new PhotoDecodeError(), "convert").code).toBe("file_unreadable");
    expect(classifyBatchFailure(new PhotoSizeError(), "upload").code).toBe("size_exceeded");
    expect(classifyBatchFailure(new TypeError("Failed to fetch"), "upload").code).toBe("network");
    expect(classifyBatchFailure(new ApiClientError(401, "unauthorized"), "upload").code).toBe(
      "unauthorized",
    );
    expect(classifyBatchFailure(new ApiClientError(413, "payload_too_large"), "upload").code).toBe(
      "size_exceeded",
    );
    expect(
      classifyBatchFailure(new ApiClientError(415, "unsupported_media_type"), "upload").code,
    ).toBe("unsupported_media");
  });

  it("429 は Retry-After の有無で一時制限と日次上限を分ける", () => {
    expect(classifyBatchFailure(new ApiClientError(429, "rate_limited"), "upload").code).toBe(
      "daily_limit",
    );
    expect(
      classifyBatchFailure(
        new ApiClientError(429, "rate_limited", undefined, undefined, 3),
        "recognize",
      ).code,
    ).toBe("rate_limited");
  });

  it("認識の上流失敗・タイムアウト・ボトル保存失敗を区別する", () => {
    expect(classifyBatchFailure(new ApiClientError(502, "upstream_error"), "recognize").code).toBe(
      "ai_failed",
    );
    const timeout = new Error("recognize_timeout");
    timeout.name = "RecognizeTimeoutError";
    expect(classifyBatchFailure(timeout, "recognize").code).toBe("ai_timeout");
    expect(classifyBatchFailure(new Error("x"), "bottle").code).toBe("bottle_save_failed");
  });

  it("オフラインは通信障害", () => {
    expect(classifyBatchFailure(new Error("x"), "upload", false).code).toBe("network");
  });
});

describe("isTransientHttpFailure / retryTransient", () => {
  it("5xx と通信切断だけ再試行し、413・429・401・容量は再送しない", async () => {
    expect(isTransientHttpFailure(new ApiClientError(503, "internal_error"))).toBe(true);
    expect(isTransientHttpFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientHttpFailure(new ApiClientError(413, "payload_too_large"))).toBe(false);
    expect(isTransientHttpFailure(new ApiClientError(429, "rate_limited"))).toBe(false);
    expect(isTransientHttpFailure(new ApiClientError(401, "unauthorized"))).toBe(false);
    expect(isTransientHttpFailure(new PhotoSizeError())).toBe(false);

    let calls = 0;
    const sleep = vi.fn(async () => {});
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw new ApiClientError(413, "payload_too_large");
        },
        { sleep, retries: 2 },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();

    calls = 0;
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          if (calls < 3) {
            throw new ApiClientError(503, "internal_error");
          }
          return "ok";
        },
        { sleep, retries: 2, random: () => 0 },
      ),
    ).resolves.toBe("ok");
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
