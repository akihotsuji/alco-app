import { randomUUID } from "node:crypto";
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
          const parsed = debugPayloadSchema.safeParse(JSON.parse(raw));
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

      const oneTapMatch = pathname.match(/^\/api\/my-drinks\/([^/]+)\/log$/);
      const deleteMatch = pathname.match(/^\/api\/drink-logs\/([^/]+)$/);
      const observesOneTap = req.method === "POST" && oneTapMatch !== null;
      const observesDelete = req.method === "DELETE" && deleteMatch !== null;
      const observesSummary = req.method === "GET" && pathname === "/api/drink-logs/summary";
      if (!observesOneTap && !observesDelete && !observesSummary) {
        next();
        return;
      }

      const requestId = randomUUID();
      res.once("finish", () => {
        const route = observesOneTap
          ? "one-tap-log"
          : observesDelete
            ? "delete-drink-log"
            : "drink-log-summary";
        const resourceId = observesOneTap
          ? (oneTapMatch?.[1] ?? null)
          : observesDelete
            ? (deleteMatch?.[1] ?? null)
            : null;
        const deletedCount = res.getHeader("x-agent-debug-deleted-count");
        // #region agent log
        appendFileSync(
          DEBUG_LOG_PATH,
          `${JSON.stringify({
            hypothesisId: observesOneTap ? "A|C" : observesDelete ? "B|C|D" : "E",
            location: "vite.config.ts:api-observer",
            message: "Observed API request completed",
            data: {
              requestId,
              method: req.method ?? null,
              route,
              resourceId,
              status: res.statusCode,
              deletedCount: deletedCount === undefined ? null : String(deletedCount),
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
