import { describe, expect, it } from "vitest";
import { RecognizeTimeoutError, withTimeout } from "./recognize.ts";

describe("withTimeout", () => {
  it("時間切れで AbortSignal を立て、RecognizeTimeoutError を返す", async () => {
    let seen: AbortSignal | undefined;
    const pending = withTimeout((signal) => {
      seen = signal;
      return new Promise<number>(() => {});
    }, 15);
    await expect(pending).rejects.toBeInstanceOf(RecognizeTimeoutError);
    expect(seen?.aborted).toBe(true);
  });

  it("完了すれば abort しない", async () => {
    const result = await withTimeout(async (signal) => {
      expect(signal.aborted).toBe(false);
      return 7;
    }, 1_000);
    expect(result).toBe(7);
  });
});
