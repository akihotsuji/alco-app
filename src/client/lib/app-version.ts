import { APP_BUILD_ID_DEV, sanitizeAppBuildId } from "@/shared/app-version.ts";

export function readClientBuildId(raw: unknown = import.meta.env.VITE_APP_BUILD_ID): string {
  return sanitizeAppBuildId(typeof raw === "string" ? raw : "") ?? APP_BUILD_ID_DEV;
}
