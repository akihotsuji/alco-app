/** `.dev.vars` / `wrangler secret` のキー。値はここに書かない。 */
const AUTH_SECRET_KEY = "BETTER_AUTH_SECRET";
const AUTH_URL_KEY = "BETTER_AUTH_URL";

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

export function resolveAuthBaseURL(env: object, requestUrl: string): string {
  const configured = readOptionalString(env, AUTH_URL_KEY);
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(requestUrl).origin;
}
