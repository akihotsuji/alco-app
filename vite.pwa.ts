import type { PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import {
  isPwaNetworkOnlyPath,
  PWA_BACKGROUND_COLOR,
  PWA_DESCRIPTION,
  PWA_DISPLAY,
  PWA_ICON_FILES,
  PWA_ICON_MANIFEST,
  PWA_ID,
  PWA_LANG,
  PWA_NAME,
  PWA_NAVIGATE_FALLBACK,
  PWA_NAVIGATE_FALLBACK_DENYLIST,
  PWA_PRECACHE_GLOB,
  PWA_PRECACHE_IGNORE,
  PWA_SCOPE,
  PWA_SHORT_NAME,
  PWA_START_URL,
  PWA_SW_FILENAME,
  PWA_THEME_COLOR_LIGHT,
  PWA_VITE_ENVIRONMENT,
} from "./src/shared/pwa.ts";

export const pwaOptions = {
  registerType: "autoUpdate" as const,
  injectRegister: false as const,
  filename: PWA_SW_FILENAME,
  includeAssets: [PWA_ICON_FILES.appleTouch],
  manifest: {
    id: PWA_ID,
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    lang: PWA_LANG,
    start_url: PWA_START_URL,
    scope: PWA_SCOPE,
    display: PWA_DISPLAY,
    theme_color: PWA_THEME_COLOR_LIGHT,
    background_color: PWA_BACKGROUND_COLOR,
    icons: [...PWA_ICON_MANIFEST],
  },
  workbox: {
    globPatterns: [...PWA_PRECACHE_GLOB],
    globIgnores: [...PWA_PRECACHE_IGNORE],
    navigateFallback: PWA_NAVIGATE_FALLBACK,
    navigateFallbackDenylist: [...PWA_NAVIGATE_FALLBACK_DENYLIST],
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) => isPwaNetworkOnlyPath(url.pathname),
        handler: "NetworkOnly" as const,
      },
    ],
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
    inlineWorkboxRuntime: true,
  },
  devOptions: {
    enabled: false,
  },
};

export function isPwaBuildEnvironment(name: string): boolean {
  return name === PWA_VITE_ENVIRONMENT;
}

export function alcoPwa(): PluginOption {
  const plugins = VitePWA(pwaOptions);
  const list = Array.isArray(plugins) ? plugins : [plugins];
  return list.map((plugin) => {
    if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
      return plugin;
    }
    return {
      ...plugin,
      applyToEnvironment(environment) {
        return isPwaBuildEnvironment(environment.name);
      },
    };
  });
}
