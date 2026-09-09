import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("AppErrorBoundary", () => {
  it("失敗時の再試行は AuthBoot 既定の再読み込みに任せる", () => {
    const source = readFileSync(join(here, "AppErrorBoundary.tsx"), "utf8");
    expect(source).toContain('variant="failed"');
    expect(source).not.toContain("onRetry");
    expect(source).toContain("isChunkLoadError");
    expect(source).toContain("recoverFromAssetFailure");
  });
});
