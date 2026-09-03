import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";

  return {
    plugins: [react(), cloudflare()],
    resolve: {
      alias: {
        "@": path.join(rootDir, "src"),
      },
    },
  };
});
