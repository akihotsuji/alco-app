import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pwa-recovery.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    colorScheme: "light",
    geolocation: { latitude: 35.6812, longitude: 139.7671 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "chromium-pwa",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: [
      "pnpm db:migrate:local",
      "CLOUDFLARE_VITE_FORCE_LOCAL=true pnpm build",
      `CLOUDFLARE_VITE_FORCE_LOCAL=true pnpm exec wrangler dev --env dev --ip ${HOST} --port ${PORT} --local`,
    ].join(" && "),
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...process.env,
      CLOUDFLARE_VITE_FORCE_LOCAL: "true",
    },
  },
});
