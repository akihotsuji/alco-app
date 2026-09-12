import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const promoRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(promoRoot, "../..");
const PORT = 5173;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./scripts",
  testMatch: "capture.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 360_000,
  expect: { timeout: 20_000 },
  use: {
    ...devices["Pixel 7"],
    baseURL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    colorScheme: "light",
    deviceScaleFactor: 3,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: `pnpm db:migrate:local && pnpm exec vite --host ${HOST} --port ${PORT} --strictPort`,
    cwd: repoRoot,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      CLOUDFLARE_VITE_FORCE_LOCAL: "true",
    },
  },
});
