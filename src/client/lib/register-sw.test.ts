import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PWA_SW_FILENAME } from "@/shared/pwa.ts";
import { shouldRegisterServiceWorker } from "./register-sw.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("installServiceWorker", () => {
  it("本番かつ ServiceWorker があるときだけ登録する", () => {
    expect(shouldRegisterServiceWorker(true, true)).toBe(true);
    expect(shouldRegisterServiceWorker(false, true)).toBe(false);
    expect(shouldRegisterServiceWorker(true, false)).toBe(false);
  });

  it("virtual モジュールやインライン登録を使わない", () => {
    const source = readFileSync(join(here, "register-sw.ts"), "utf8");
    const main = readFileSync(join(here, "../main.tsx"), "utf8");
    expect(source).toContain("PWA_SW_FILENAME");
    expect(PWA_SW_FILENAME).toBe("sw.js");
    expect(source).toContain("serviceWorker.register");
    expect(source).not.toContain("virtual:pwa-register");
    expect(source).not.toContain("workbox-window");
    expect(main).toContain("installServiceWorker()");
  });
});
