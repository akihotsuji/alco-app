/**
 * PWA の契約（6-01）。正本は spec/features/pwa.md。
 * マニフェスト・SW・テーマカラー・アイコン生成が同じ値を使う。
 */

export const PWA_NAME = "alco-app";
export const PWA_SHORT_NAME = "alco";
export const PWA_DESCRIPTION = "お酒の記録・セラー・テイスティングノート";
export const PWA_LANG = "ja";
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
export const PWA_DISPLAY = "standalone" as const;
export const PWA_ID = "/";

/** ライトの --background。マニフェストの theme_color / background_color と初回の theme-color */
export const PWA_THEME_COLOR_LIGHT = "#E6E0D6";
/** ダークの --background。prefers-color-scheme と解決済みテーマ用 */
export const PWA_THEME_COLOR_DARK = "#2C2926";
export const PWA_BACKGROUND_COLOR = PWA_THEME_COLOR_LIGHT;

/** アイコン地。ライトの --primary。テーマでは変えない */
export const PWA_ICON_BACKGROUND = "#7A3538";
/** primary 地で輪郭が見えるようにする線色（ライトの --primary-fg） */
export const PWA_ICON_LINE = "#FFF8F4";
export const PWA_ICON_SIZE = 512;
/** マスク可能セーフゾーン（内側 80%）に収める */
export const PWA_ICON_MASCOT_HEIGHT_RATIO = 0.62;

export const PWA_SW_FILENAME = "sw.js";
/** Cloudflare Vite の worker 環境には SW を出さない */
export const PWA_VITE_ENVIRONMENT = "client";

export const PWA_ICON_DIR = "pwa";

export const PWA_ICON_FILES = {
  any192: `${PWA_ICON_DIR}/pwa-192x192.png`,
  any512: `${PWA_ICON_DIR}/pwa-512x512.png`,
  maskable512: `${PWA_ICON_DIR}/pwa-512x512-maskable.png`,
  appleTouch: `${PWA_ICON_DIR}/apple-touch-icon.png`,
} as const;

export const PWA_ICON_MANIFEST = [
  { src: `/${PWA_ICON_FILES.any192}`, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: `/${PWA_ICON_FILES.any512}`, sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: `/${PWA_ICON_FILES.maskable512}`,
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;

export const PWA_PRECACHE_GLOB = ["**/*.{js,css,html,ico,png,svg,webp,webmanifest}"] as const;
/** 切り抜きモデルは既存の Cache API。SW precache に載せない */
export const PWA_PRECACHE_IGNORE = ["**/models/**"] as const;
export const PWA_NAVIGATE_FALLBACK = "index.html";
export const PWA_NAVIGATE_FALLBACK_DENYLIST = [/^\/api(?:\/|$)/];

/** セッション付き JSON / 認可付き写真を SW がキャッシュしない */
export function isPwaNetworkOnlyPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
