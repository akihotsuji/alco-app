/** 未ログイン・セッション切れの着地先。元の URL は `redirect` で持ち回る（spec/screen-designs/00-common.md 2.4）。 */
export function loginPathFor(location: { pathname: string; search: string }): string {
  const redirect = `${location.pathname}${location.search}`;
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}

/**
 * API が 401 を返したときの遷移。Better Auth クライアントが持つセッションのキャッシュも
 * 捨てる必要があるため、SPA 内遷移ではなくフルロードで `/login` へ移る（メモリ上の query も消える）。
 */
export function redirectToLogin(): void {
  window.location.replace(loginPathFor(window.location));
}
