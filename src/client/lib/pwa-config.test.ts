import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PWA_DISPLAY,
  PWA_SW_FILENAME,
  PWA_THEME_COLOR_DARK,
  PWA_THEME_COLOR_LIGHT,
} from "@/shared/pwa.ts";
import { isPwaBuildEnvironment, pwaOptions } from "../../../vite.pwa.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("PWA 設定ファイル", () => {
  it("SW は API を NetworkOnly にし、インライン登録しない", () => {
    expect(isPwaBuildEnvironment("client")).toBe(true);
    expect(isPwaBuildEnvironment("alco_app")).toBe(false);
    expect(pwaOptions.injectRegister).toBe(false);
    expect(pwaOptions.registerType).toBe("autoUpdate");
    expect(pwaOptions.filename).toBe(PWA_SW_FILENAME);
    expect(pwaOptions.manifest.display).toBe(PWA_DISPLAY);
    expect(pwaOptions.workbox.skipWaiting).toBe(true);
    expect(pwaOptions.workbox.inlineWorkboxRuntime).toBe(true);
    expect(pwaOptions.workbox.runtimeCaching).toEqual([
      expect.objectContaining({ handler: "NetworkOnly" }),
    ]);
    const apiUrl = new URL("https://example.test/api/me");
    expect(pwaOptions.workbox.runtimeCaching[0]?.urlPattern({ url: apiUrl })).toBe(true);
    const pageUrl = new URL("https://example.test/logs");
    expect(pwaOptions.workbox.runtimeCaching[0]?.urlPattern({ url: pageUrl })).toBe(false);
  });

  it("index.html に Apple メタとライト／ダークの theme-color がある", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    expect(html).toContain('content="yes"');
    expect(html).toContain('content="alco"');
    expect(html).toContain(`content="${PWA_THEME_COLOR_LIGHT}"`);
    expect(html).toContain(`content="${PWA_THEME_COLOR_DARK}"`);
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain("/pwa/apple-touch-icon.png");
  });

  it("_headers が SW をキャッシュせず CSP で manifest を許可する", () => {
    const headers = readFileSync(join(root, "public/_headers"), "utf8");
    expect(headers).toContain("/sw.js");
    expect(headers).toContain("Cache-Control: no-cache");
    expect(headers).toContain("manifest-src 'self'");
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy:"));
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("unsafe-inline");
  });
});
