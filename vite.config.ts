import { appendFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { z } from "zod";
import { srcAlias } from "./vite.alias.ts";

const DEBUG_LOG_PATH = "/opt/cursor/logs/debug.log";
const debugPayloadSchema = z
  .object({
    hypothesisId: z.string(),
    location: z.string(),
    message: z.string(),
    data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    timestamp: z.number(),
  })
  .strict();

const agentDebugPlugin = {
  name: "agent-debug-log",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "POST" && pathname === "/__agent-debug-log") {
        let raw = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          raw += chunk;
        });
        req.on("end", () => {
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            res.statusCode = 400;
            res.end();
            return;
          }
          const parsed = debugPayloadSchema.safeParse(body);
          if (!parsed.success) {
            res.statusCode = 400;
            res.end();
            return;
          }
          // #region agent log
          appendFileSync(DEBUG_LOG_PATH, `${JSON.stringify(parsed.data)}\n`);
          // #endregion
          res.statusCode = 204;
          res.end();
        });
        return;
      }

      const deleteMatch = pathname.match(/^\/api\/drink-logs\/([^/]+)$/);
      const observesDelete = req.method === "DELETE" && deleteMatch !== null;
      const observesSummary = req.method === "GET" && pathname === "/api/drink-logs/summary";
      if (!observesDelete && !observesSummary) {
        next();
        return;
      }

      res.once("finish", () => {
        const deletedCount = res.getHeader("x-agent-debug-deleted-count");
        const remainingCount = res.getHeader("x-agent-debug-remaining-count");
        // #region agent log
        appendFileSync(
          DEBUG_LOG_PATH,
          `${JSON.stringify({
            hypothesisId: observesDelete ? "C|D" : "E",
            location: "vite.config.ts:api-observer",
            message: "Observed API request completed",
            data: {
              method: req.method ?? null,
              route: observesDelete ? "delete-drink-log" : "drink-log-summary",
              resourceId: observesDelete ? (deleteMatch?.[1] ?? null) : null,
              query: observesSummary ? new URL(req.url ?? "/", "http://localhost").search : null,
              status: res.statusCode,
              deletedCount: deletedCount === undefined ? null : String(deletedCount),
              remainingCount: remainingCount === undefined ? null : String(remainingCount),
            },
            timestamp: Date.now(),
          })}\n`,
        );
        // #endregion
      });
      next();
    });
  },
} satisfies Plugin;

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";

  return {
    plugins: [agentDebugPlugin, react(), tailwindcss(), cloudflare()],
    resolve: {
      alias: srcAlias,
    },
  };
});
