import { describe, expect, it } from "vitest";
import { DARK_COLOR_TOKENS, LIGHT_COLOR_TOKENS } from "@/client/lib/design-tokens.ts";
import {
  isPwaNetworkOnlyPath,
  PWA_BACKGROUND_COLOR,
  PWA_DISPLAY,
  PWA_ICON_BACKGROUND,
  PWA_ICON_LINE,
  PWA_ICON_MANIFEST,
  PWA_NAME,
  PWA_NAVIGATE_FALLBACK_DENYLIST,
  PWA_PRECACHE_IGNORE,
  PWA_SHORT_NAME,
  PWA_START_URL,
  PWA_THEME_COLOR_DARK,
  PWA_THEME_COLOR_LIGHT,
  PWA_VITE_ENVIRONMENT,
} from "./pwa.ts";

describe("pwa 契約", () => {
  it("表示名とスタンドアロン起動の値が仕様どおり", () => {
    expect(PWA_NAME).toBe("さけしおり");
    expect(PWA_SHORT_NAME).toBe("さけしおり");
    expect(PWA_START_URL).toBe("/");
    expect(PWA_DISPLAY).toBe("standalone");
    expect(PWA_VITE_ENVIRONMENT).toBe("client");
  });

  it("テーマカラーが design-system の地色と一致する", () => {
    expect(PWA_THEME_COLOR_LIGHT.toLowerCase()).toBe(LIGHT_COLOR_TOKENS["--background"]);
    expect(PWA_THEME_COLOR_DARK.toLowerCase()).toBe(DARK_COLOR_TOKENS["--background"]);
    expect(PWA_BACKGROUND_COLOR).toBe(PWA_THEME_COLOR_LIGHT);
  });

  it("アイコン地はライトの地、線は前景でキャラのワインと溶けない", () => {
    expect(PWA_ICON_BACKGROUND.toLowerCase()).toBe(LIGHT_COLOR_TOKENS["--background"]);
    expect(PWA_ICON_LINE.toLowerCase()).toBe(LIGHT_COLOR_TOKENS["--foreground"]);
    expect(PWA_ICON_BACKGROUND.toLowerCase()).not.toBe(LIGHT_COLOR_TOKENS["--primary"]);
    expect(PWA_ICON_BACKGROUND.toLowerCase()).not.toBe(LIGHT_COLOR_TOKENS["--mascot-wine"]);
  });

  it("マニフェストアイコンに 192 / 512 / maskable がある", () => {
    const purposes = PWA_ICON_MANIFEST.map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(purposes).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
  });

  it("API は NetworkOnly、モデルは precache しない", () => {
    expect(isPwaNetworkOnlyPath("/api")).toBe(true);
    expect(isPwaNetworkOnlyPath("/api/health")).toBe(true);
    expect(isPwaNetworkOnlyPath("/api/photos/x/content")).toBe(true);
    expect(isPwaNetworkOnlyPath("/apifake")).toBe(false);
    expect(isPwaNetworkOnlyPath("/")).toBe(false);
    expect(PWA_PRECACHE_IGNORE).toContain("**/models/**");
    expect(PWA_NAVIGATE_FALLBACK_DENYLIST.some((rule) => rule.test("/api/drink-logs"))).toBe(true);
    expect(PWA_NAVIGATE_FALLBACK_DENYLIST.some((rule) => rule.test("/logs"))).toBe(false);
  });
});
