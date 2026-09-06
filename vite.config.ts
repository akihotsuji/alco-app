import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { srcAlias } from "./vite.alias.ts";

const AGENT_DEBUG_LOG = "/opt/cursor/logs/debug.log";

function appendAgentDebug(data: unknown): void {
  const line = typeof data === "string" ? data : JSON.stringify(data);
  fs.mkdirSync("/opt/cursor/logs", { recursive: true });
  fs.appendFileSync(AGENT_DEBUG_LOG, line.endsWith("\n") ? line : `${line}\n`);
}

/** ブラウザ計測を /opt/cursor/logs/debug.log に書く（切り分け後に削除） */
function agentDebugLogPlugin(): Plugin {
  function handlePost(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const pathOnly = req.url?.split("?")[0];
    if (pathOnly !== "/__agent_debug_log" || req.method !== "POST") {
      next();
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        if (raw) {
          appendAgentDebug(JSON.parse(raw) as unknown);
        }
      } catch {
        // 切り分け用。失敗しても開発サーバーは止めない
      }
      res.statusCode = 204;
      res.end();
    });
  }

  return {
    name: "agent-debug-log",
    configureServer(server: ViteDevServer) {
      server.ws.on("agent-debug-log", (data: unknown) => {
        try {
          appendAgentDebug(data);
        } catch {
          // ignore
        }
      });
      server.middlewares.use(handlePost);
      const last = server.middlewares.stack.pop();
      if (last) {
        server.middlewares.stack.unshift(last);
      }
    },
  };
}

export default defineConfig(() => {
  // 日常の vite / vite build は wrangler の env.dev を使う
  process.env.CLOUDFLARE_ENV ??= "dev";

  return {
    plugins: [agentDebugLogPlugin(), react(), tailwindcss(), cloudflare()],
    resolve: {
      alias: srcAlias,
    },
  };
});
