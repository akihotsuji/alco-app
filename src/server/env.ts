import { readCanonicalOrigin } from "./canonical-redirect.ts";

/** `.dev.vars` / `wrangler secret` のキー。値はここに書かない。 */
const AUTH_SECRET_KEY = "BETTER_AUTH_SECRET";
const AUTH_URL_KEY = "BETTER_AUTH_URL";
const GOOGLE_CLIENT_ID_KEY = "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_KEY = "GOOGLE_CLIENT_SECRET";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
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
