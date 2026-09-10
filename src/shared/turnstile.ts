import { z } from "zod";

/** Better Auth 公式 captcha プラグインと同じヘッダー名。 */
export const TURNSTILE_TOKEN_HEADER = "x-captcha-response";

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export const TURNSTILE_SITEVERIFY_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/siteverify`;

export const TURNSTILE_VERIFY_TIMEOUT_MS = 10_000;
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** サイトキーは公開値。形式だけ見る（値はコードに書かない）。 */
export const TURNSTILE_SITE_KEY_RE = /^[0-9A-Za-z_-]{10,200}$/;

export const publicConfigSchema = z
  .object({
    turnstileSiteKey: z.string().min(1).nullable(),
  })
  .strict();

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const TURNSTILE_PROTECTED_AUTH_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/sign-in/social",
] as const;

export function isTurnstileProtectedAuthPath(path: string): boolean {
  return (TURNSTILE_PROTECTED_AUTH_PATHS as readonly string[]).includes(path);
}

export function turnstileRequestHeaders(token: string | null): Record<string, string> {
  if (!token) {
    return {};
  }
  return { [TURNSTILE_TOKEN_HEADER]: token };
}
