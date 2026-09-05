/**
 * 未ログインで来た URL を `/login?redirect=` に載せる。`/` は既定の戻り先なので付けない
 * （ログアウト直後の URL を `/login` のまま保つ）。
 */
export function loginPathFor(pathname: string, search = ""): string {
  const redirect = `${pathname}${search}`;
  return redirect === "/" ? "/login" : `/login?redirect=${encodeURIComponent(redirect)}`;
}
