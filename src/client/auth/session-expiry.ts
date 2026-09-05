import { authClient } from "@/client/lib/auth-client.ts";

export type SessionExpiryDeps = {
  /** Better Auth のサインアウト。成功すればクライアントのセッション store が自動で再取得される。 */
  signOut: () => Promise<{ error: unknown }>;
  /** サインアウトが失敗しても（Cookie 消失など）セッション store を再取得させる。 */
  refreshSession: () => void;
};

/**
 * API が 401 を返したときの処理。サーバー側のセッションは既に無効なので、クライアントの
 * セッション store を空にして `RequireAuth` に `/login?redirect=` へ送らせる。
 * 同時に複数の query が 401 になっても signOut は 1 回だけ走る。
 */
export function createSessionExpiryHandler(deps: SessionExpiryDeps): () => Promise<void> {
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

export const expireSession = createSessionExpiryHandler({
  signOut: () => authClient.signOut(),
  refreshSession: () => authClient.$store.notify("$sessionSignal"),
});
