/**
 * 未ログインで来た URL を `/login?redirect=` に載せる。`/` は既定の戻り先なので付けない
 * （ログアウト直後の URL を `/login` のまま保つ）。
 */
export function loginPathFor(pathname: string, search = ""): string {
  const redirect = `${pathname}${search}`;
  return redirect === "/" ? "/login" : hrefWithRedirect("/login", redirect);
}

/** ログイン / サインアップ間で `redirect` クエリを引き継ぐ。 */
export function hrefWithRedirect(path: "/login" | "/signup", redirectQuery: string | null): string {
  return redirectQuery ? `${path}?redirect=${encodeURIComponent(redirectQuery)}` : path;
}
