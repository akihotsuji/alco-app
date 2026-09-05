import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useMe } from "@/client/hooks/use-me.ts";
import { authClient } from "@/client/lib/auth-client.ts";

/**
 * Phase 2 の空ホーム。ログアウトと `GET /api/me` の表示は 2-05 で設定画面へ移すまでの仮置き
 * （spec/features/auth.md）。
 */
export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function onLogout() {
    await authClient.signOut();
    // 共有端末で次のユーザーに前のユーザーのデータを見せない
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <main className="home-stub">
      <h1>alco-app</h1>
      <MeCard />
      <button className="auth-submit home-logout" type="button" onClick={onLogout}>
        ログアウト
      </button>
    </main>
  );
}

function MeCard() {
  const me = useMe();

  if (me.isPending) {
    return <div className="home-me home-me-skeleton" aria-busy="true" />;
  }
  if (me.isError) {
    return (
      <div className="home-me" role="alert">
        <p className="home-me-error">読み込めませんでした</p>
        <button className="home-me-retry" type="button" onClick={() => me.refetch()}>
          再試行
        </button>
      </div>
    );
  }
  return (
    <div className="home-me">
      {me.data.name ? <p className="home-me-name">{me.data.name}</p> : null}
      <p className="home-me-email">{me.data.email}</p>
    </div>
  );
}
