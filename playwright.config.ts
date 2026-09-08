import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
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
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `pnpm db:migrate:local && pnpm exec vite --host ${HOST} --port ${PORT} --strictPort`
      : `pnpm exec vite --host ${HOST} --port ${PORT} --strictPort`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      CLOUDFLARE_VITE_FORCE_LOCAL: "true",
    },
  },
});
