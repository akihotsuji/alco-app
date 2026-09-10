import { TURNSTILE_SITE_KEY_RE } from "@/shared/turnstile.ts";
import { readCanonicalOrigin } from "./canonical-redirect.ts";

/** `.dev.vars` / `wrangler secret` のキー。値はここに書かない。 */
const AUTH_SECRET_KEY = "BETTER_AUTH_SECRET";
const AUTH_URL_KEY = "BETTER_AUTH_URL";
const GOOGLE_CLIENT_ID_KEY = "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_KEY = "GOOGLE_CLIENT_SECRET";
const TURNSTILE_SITE_KEY_KEY = "TURNSTILE_SITE_KEY";
const TURNSTILE_SECRET_KEY_KEY = "TURNSTILE_SECRET_KEY";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export type TurnstileEnvConfig = {
  siteKey: string;
  secret: string;
};

function readOptionalString(env: object, key: string): string | undefined {
  const value = Reflect.get(env, key);
  return typeof value === "string" ? value : undefined;
}

export function readAuthSecret(env: object): string {
  const secret = readOptionalString(env, AUTH_SECRET_KEY);
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return secret;
}

export function readGoogleOAuthConfig(env: object): GoogleOAuthConfig | undefined {
  const clientId = readOptionalString(env, GOOGLE_CLIENT_ID_KEY);
  const clientSecret = readOptionalString(env, GOOGLE_CLIENT_SECRET_KEY);
  if (!clientId || !clientSecret) {
    return undefined;
  }
  return { clientId, clientSecret };
}

/** サイトキーとシークレットが両方揃い、サイトキーの形式が正しいときだけ有効。 */
export function readTurnstileConfig(env: object): TurnstileEnvConfig | undefined {
  const siteKey = readOptionalString(env, TURNSTILE_SITE_KEY_KEY);
  const secret = readOptionalString(env, TURNSTILE_SECRET_KEY_KEY);
  if (!siteKey || !secret || !TURNSTILE_SITE_KEY_RE.test(siteKey)) {
    return undefined;
  }
  return { siteKey, secret };
}

export function resolveAuthBaseURL(env: object, requestUrl: string): string {
  const configured = readOptionalString(env, AUTH_URL_KEY);
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const canonical = readCanonicalOrigin(env);
  if (canonical) {
    return canonical;
  }
  return new URL(requestUrl).origin;
}
