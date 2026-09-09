import { describe, expect, it } from "vitest";
import { summarizeAiError } from "./error-summary.ts";

describe("summarizeAiError", () => {
  it("status と短いメッセージを残す", () => {
    const error = Object.assign(new Error("insufficient credits"), {
      status: 403,
      code: "billing",
    });
    expect(summarizeAiError(error)).toContain("status=403");
    expect(summarizeAiError(error)).toContain("code=billing");
    expect(summarizeAiError(error)).toContain("insufficient credits");
  });

  it("入れ子の cause / error を辿る", () => {
    const error = {
      message: "upstream",
      cause: { statusCode: 400, error: { message: "invalid request" } },
    };
    const summary = summarizeAiError(error);
    expect(summary).toContain("status=400");
    expect(summary).toContain("invalid request");
  });

  it("写真 data URI と長い Base64 を落とす", () => {
    const b64 = "A".repeat(120);
    const error = new Error(`payload data:image/jpeg;base64,${b64} extra`);
    const summary = summarizeAiError(error);
    expect(summary).toContain("[image]");
    expect(summary).not.toContain(b64);
  });

  it("空や未知は unknown", () => {
    expect(summarizeAiError(null)).toBe("unknown");
    expect(summarizeAiError(undefined)).toBe("unknown");
    expect(summarizeAiError(12)).toBe("unknown");
  });
});
