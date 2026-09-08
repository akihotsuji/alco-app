import { describe, expect, it } from "vitest";
import { redactWranglerLog } from "@/ci/redact-wrangler-log.ts";

describe("redactWranglerLog", () => {
  it("replaces workers.dev URLs", () => {
    const input = "Deployed\nhttps://alco-app-dev.example.workers.dev\nCurrent Version ID: abc";
    expect(redactWranglerLog(input)).toBe(
      "Deployed\n[redacted-url]\nCurrent Version ID: abc",
    );
  });

  it("replaces http workers.dev URLs", () => {
    expect(redactWranglerLog("see http://foo.workers.dev/path")).toBe("see [redacted-url]");
  });

  it("leaves non-URL wrangler output intact", () => {
    const input = "Uploaded alco-app-dev (1.2 sec)\nApplied 0 migrations";
    expect(redactWranglerLog(input)).toBe(input);
  });
});
