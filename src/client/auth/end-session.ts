import { authClient } from "@/client/lib/auth-client.ts";

export type EndSessionDeps = {
  /** Better Auth のサインアウト。成功すればクライアントのセッション store が自動で再取得される。 */
  signOut: () => Promise<{ error: unknown }>;
  /** サインアウトが失敗しても（Cookie 消失など）セッション store を再取得させる。 */
  refreshSession: () => void;
};

/**
 * セッションを終わらせる。明示的なログアウトと、API が 401 を返したとき（サーバー側で既に
 * 失効）の両方で使う。ここでは画面遷移もキャッシュ削除もしない。セッション store が空になると
 * `RequireAuth` が query キャッシュを捨てて `/login` へ送る（経路を 1 本にして競合を避ける）。
 * 同時に複数の query が 401 になっても signOut は 1 回だけ走る。
 */
export function createEndSessionHandler(deps: EndSessionDeps): () => Promise<void> {
  let inFlight: Promise<void> | null = null;

  const run = async () => {
    const result = await deps.signOut().catch((error: unknown) => ({ error }));
    if (result.error) {
      deps.refreshSession();
    }
  };

  return () => {
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

export const endSession = createEndSessionHandler({
  signOut: () => authClient.signOut(),
  refreshSession: () => authClient.$store.notify("$sessionSignal"),
});
