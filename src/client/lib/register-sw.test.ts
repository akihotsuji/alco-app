import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("installServiceWorker", () => {
  it("本番だけ virtual:pwa-register で即時登録する", () => {
    const source = readFileSync(join(here, "register-sw.ts"), "utf8");
    const main = readFileSync(join(here, "../main.tsx"), "utf8");
    expect(source).toContain('from "virtual:pwa-register"');
    expect(source).toContain("import.meta.env.PROD");
    expect(source).toContain("immediate: true");
    expect(main).toContain("installServiceWorker()");
  });
});
