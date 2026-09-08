import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { srcAlias } from "./vite.alias.ts";
import { cutoutAssets } from "./vite.cutout-assets.ts";
import { alcoPwa } from "./vite.pwa.ts";
import { pwaIcons } from "./vite.pwa-icons.ts";

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";
  // E2E / CI は Workers AI のリモートプロキシを切る（トークン不要。認識 API は叩かない）
  const forceLocal = process.env.CLOUDFLARE_VITE_FORCE_LOCAL === "true";

  return {
    plugins: [
      react(),
      tailwindcss(),
      cutoutAssets(),
      pwaIcons(),
      alcoPwa(),
      cloudflare(forceLocal ? { remoteBindings: false } : {}),
    ],
    resolve: {
      alias: srcAlias,
    },
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
    ssr: {
      external: ["onnxruntime-web"],
    },
  };
});
