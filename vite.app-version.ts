import { execFileSync } from "node:child_process";
import type { PluginOption } from "vite";
import {
  APP_VERSION_FILENAME,
  createAppVersionManifest,
  resolveAppBuildIdFromEnv,
} from "./src/shared/app-version.ts";
import { PWA_VITE_ENVIRONMENT } from "./src/shared/pwa.ts";

export function readGitShortSha(): string | undefined {
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return sha || undefined;
  } catch {
    return undefined;
  }
}

export function resolveBuildTimeAppBuildId(
  env: Record<string, string | undefined> = process.env,
): string {
  return resolveAppBuildIdFromEnv(env, readGitShortSha());
}

export function alcoAppVersion(): PluginOption {
  const buildId = resolveBuildTimeAppBuildId();
  const body = JSON.stringify(createAppVersionManifest(buildId));

  return [
    {
      name: "alco-app-version-config",
      config() {
        process.env.VITE_APP_BUILD_ID = buildId;
        return {
          define: {
            "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(buildId),
          },
        };
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url?.split("?")[0];
          if (path !== `/${APP_VERSION_FILENAME}`) {
            next();
            return;
          }
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(body);
        });
      },
    },
    {
      name: "alco-app-version-emit",
      apply: "build",
      applyToEnvironment(environment) {
        return environment.name === PWA_VITE_ENVIRONMENT;
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: APP_VERSION_FILENAME,
          source: body,
        });
      },
    },
  ];
}
