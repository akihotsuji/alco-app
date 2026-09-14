import { describe, expect, it } from "vitest";
import { batchTracePayload } from "./bottle-batch-trace.ts";

describe("batchTracePayload", () => {
  it("工程と件数・寸法は残し、ファイル名・画像・認証は載せない", () => {
    const payload = batchTracePayload({
      ingestId: "ing-1",
      rowKey: "row-1",
      stage: "upload",
      outcome: "error",
      code: "size_exceeded",
      httpStatus: 413,
      elapsedMs: 120,
      bytes: 2048,
      width: 853,
      height: 1280,
      mime: "image/jpeg",
      picked: 6,
      accepted: 5,
      overflow: 1,
    });
    const text = JSON.stringify(payload);
    expect(payload).toMatchObject({
      ingestId: "ing-1",
      rowKey: "row-1",
      stage: "upload",
      code: "size_exceeded",
      httpStatus: 413,
      bytes: 2048,
      mime: "image/jpeg",
      picked: 6,
      overflow: 1,
    });
    expect(text).not.toContain("data:image");
    expect(text).not.toContain("filename");
    expect(text).not.toContain("Bearer");
    expect(text).not.toContain("cookie");
  });
});
