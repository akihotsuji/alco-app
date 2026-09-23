/**
 * signIn / signUp の成功後は、セッション store を取り直してから遷移する。
 * Better Auth は再取得の合図を約 10ms 遅らせるため、すぐ遷移すると `RequireAuth` が
 * まだ未ログインと判定して `/login` へ戻し、`redirect` の行き先を失う。
 * 取り直しが失敗しても遷移は止めない（`RequireAuth` の起動画面・再試行に任せる）。
 */
export async function navigateAfterSignIn(
  refetchSession: () => Promise<unknown>,
  go: () => void,
): Promise<void> {
  await refetchSession().catch(() => undefined);
  go();
}
