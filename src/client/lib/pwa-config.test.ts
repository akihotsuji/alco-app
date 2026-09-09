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
    expect(pwaOptions.workbox.clientsClaim).toBe(true);
    expect(pwaOptions.workbox.inlineWorkboxRuntime).toBe(true);
    expect(pwaOptions.workbox.navigateFallbackDenylist.map(String).join(" ")).toContain("assets");
    expect(pwaOptions.workbox.runtimeCaching).toEqual([
      expect.objectContaining({ handler: "NetworkOnly" }),
      expect.objectContaining({ handler: "NetworkOnly" }),
    ]);
    const apiPattern = pwaOptions.workbox.runtimeCaching[0]?.urlPattern as
      | ((ctx: { url: URL }) => boolean)
      | undefined;
    const assetPattern = pwaOptions.workbox.runtimeCaching[1]?.urlPattern as
      | ((ctx: { request: { destination: string }; url: URL }) => boolean)
      | undefined;
    expect(apiPattern?.toString()).not.toContain("isPwaNetworkOnlyPath");
    expect(assetPattern?.toString()).not.toContain("isPwaNetworkOnlyPath");
    const apiUrl = new URL("https://example.test/api/me");
    expect(apiPattern?.({ url: apiUrl })).toBe(true);
    const pageUrl = new URL("https://example.test/logs");
    expect(apiPattern?.({ url: pageUrl })).toBe(false);
    const scriptReq = { destination: "script" };
    expect(
      assetPattern?.({ request: scriptReq, url: new URL("https://example.test/assets/old.js") }),
    ).toBe(true);
    expect(assetPattern?.({ request: scriptReq, url: apiUrl })).toBe(false);
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
    expect(html).toContain("/boot.css");
    expect(html).toContain("/boot-guard.js");
    expect(html).toContain("読み込み中");
    expect(html).toContain("data-boot-html");
  });

  it("_headers が SW をキャッシュせず CSP で manifest を許可する", () => {
    const headers = readFileSync(join(root, "public/_headers"), "utf8");
    expect(headers).toContain("/sw.js");
    expect(headers).toContain("/boot-guard.js");
    expect(headers).toContain("/boot.css");
    expect(headers).toContain("Cache-Control: no-cache");
    expect(headers).toMatch(/\/\*\n {2}Cache-Control: no-cache/);
    expect(headers).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
    expect(headers).toContain("manifest-src 'self'");
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy:"));
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("unsafe-inline");
  });
});
