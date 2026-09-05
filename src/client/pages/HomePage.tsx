import { endSession } from "@/client/auth/end-session.ts";
import { useMe } from "@/client/hooks/use-me.ts";

/** Phase 2 の仮ホーム。2-05 で共通レイアウト、3-03 / 3-06 で screen-designs/02-home.md に置き換える。 */
export function HomePage() {
  return (
    <main className="home-stub">
      <h1>alco-app</h1>
      <Account />
      <button
        className="auth-submit home-logout"
        type="button"
        onClick={() => {
          void endSession();
        }}
      >
        ログアウト
      </button>
    </main>
  );
}

/** `useMe`（Hono RPC + TanStack Query）のサンプル。表示名が空ならメールを出す。 */
function Account() {
  const me = useMe();

  if (me.isPending) {
    return <p className="home-account home-account-loading" aria-busy="true" />;
  }
  if (me.isError) {
    return (
      <p className="home-account" role="alert">
        読み込めませんでした
        <button
          className="home-retry"
          type="button"
          onClick={() => me.refetch()}
          disabled={me.isFetching}
        >
          再試行
        </button>
      </p>
    );
  }
  return <p className="home-account">{me.data.name || me.data.email}</p>;
}
