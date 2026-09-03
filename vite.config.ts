import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { srcAlias } from "./vite.alias.ts";

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";

  return {
    plugins: [react(), cloudflare()],
    resolve: {
      alias: srcAlias,
    },
  };
});
