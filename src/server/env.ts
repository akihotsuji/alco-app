/** `.dev.vars` / `wrangler secret` のキー。値はここに書かない。 */
export type AuthBindings = Env & {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
};

export function readAuthSecret(env: Env): string {
  const secret = (env as AuthBindings).BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return secret;
}

export function resolveAuthBaseURL(env: Env, requestUrl: string): string {
  const configured = (env as AuthBindings).BETTER_AUTH_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(requestUrl).origin;
}
