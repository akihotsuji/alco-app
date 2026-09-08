/** Better Auth 既定。Secure 時は `__Secure-` 接頭。値は読まない（先読みのヒントだけ） */
const SESSION_COOKIE_NAME = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/;

export function hasSessionCookie(cookie: string): boolean {
  return SESSION_COOKIE_NAME.test(cookie);
}
