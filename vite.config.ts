import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appendFileSync } from "node:fs";
import { defineConfig } from "vite";
import { srcAlias } from "./vite.alias.ts";

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";

  return {
    plugins: [
      {
        name: "agent-debug-log",
        configureServer(server) {
          server.middlewares.use("/__agent-debug-log", (request, response, next) => {
            if (request.method !== "POST") {
              next();
              return;
            }
            let body = "";
            request.setEncoding("utf8");
            request.on("data", (chunk: string) => {
              body += chunk;
            });
            request.on("end", () => {
              try {
                const entry: unknown = JSON.parse(body);
                // #region agent log
                appendFileSync("/opt/cursor/logs/debug.log", `${JSON.stringify(entry)}\n`);
                // #endregion
                response.statusCode = 204;
                response.end();
              } catch {
                response.statusCode = 400;
                response.end();
              }
            });
          });
        },
      },
      react(),
      tailwindcss(),
      cloudflare(),
    ],
    resolve: {
      alias: srcAlias,
    },
  };
});
