import { z } from "zod";
import { APP_VERSION, PHOTO_CUTOUT_CACHE } from "./constants.ts";

/** 設定 S7 / `/version.json`。正本は spec/features/pwa.md 6.1 */
export const APP_VERSION_FILENAME = "version.json";
export const APP_VERSION_PATH = `/${APP_VERSION_FILENAME}`;
export const APP_BUILD_ID_DEV = "dev";
export const APP_BUILD_ID_LENGTH = 7;
export const APP_REFRESH_UPDATE_TIMEOUT_MS = 8_000;
export const VERSION_WATCH_MIN_INTERVAL_MS = 30_000;

export const APP_REFRESH_COPY = {
  label: "最新の状態にする",
  caption: "表示している版を、配信中の最新に揃えます",
  pending: "最新化しています",
  offline: "オフラインです。接続してからもう一度試してください",
} as const;

const appBuildIdSchema = z
  .string()
  .trim()
  .regex(/^(?:dev|[0-9a-f]{7,40})$/i);

const appVersionManifestSchema = z
  .object({
    version: z.string().trim().min(1).max(32),
    buildId: appBuildIdSchema,
  })
  .strict();

export type AppVersionManifest = z.infer<typeof appVersionManifestSchema>;

export function sanitizeAppBuildId(raw: string): string | null {
  const parsed = appBuildIdSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.toLowerCase() === APP_BUILD_ID_DEV) {
    return APP_BUILD_ID_DEV;
  }
  return parsed.data.slice(0, APP_BUILD_ID_LENGTH).toLowerCase();
}

export function resolveAppBuildId(input: {
  explicit?: string;
  githubSha?: string;
  gitSha?: string;
}): string {
  return (
    sanitizeAppBuildId(input.explicit ?? "") ??
    sanitizeAppBuildId(input.githubSha ?? "") ??
    sanitizeAppBuildId(input.gitSha ?? "") ??
    APP_BUILD_ID_DEV
  );
}

export function resolveAppBuildIdFromEnv(
  env: Record<string, string | undefined>,
  gitSha?: string,
): string {
  return resolveAppBuildId({
    explicit: env.VITE_APP_BUILD_ID,
    githubSha: env.GITHUB_SHA,
    gitSha,
  });
}

export function formatAppVersionLabel(name: string, version: string, buildId: string): string {
  return `${name} ${version} (${buildId})`;
}

export function parseAppVersionManifest(data: unknown): AppVersionManifest | null {
  const parsed = appVersionManifestSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  const buildId = sanitizeAppBuildId(parsed.data.buildId);
  if (!buildId) {
    return null;
  }
  return { version: parsed.data.version, buildId };
}

export function createAppVersionManifest(buildId: string): AppVersionManifest {
  return { version: APP_VERSION, buildId };
}

export function shouldNotifyPublishedUpdate(
  currentBuildId: string,
  published: AppVersionManifest | null,
): boolean {
  return published !== null && published.buildId !== currentBuildId;
}

export function shouldRunVersionCheck(
  lastAt: number | null,
  now: number,
  intervalMs: number,
): boolean {
  if (lastAt === null) {
    return true;
  }
  return now - lastAt >= intervalMs;
}

/** Workbox の precache だけ消す。切り抜きモデルは残す */
export function isForceRefreshCacheKey(key: string): boolean {
  if (key === PHOTO_CUTOUT_CACHE) {
    return false;
  }
  const lower = key.toLowerCase();
  return lower.includes("workbox") || lower.includes("precache");
}
