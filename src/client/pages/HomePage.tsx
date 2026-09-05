import { useNavigate } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";

export function HomePage() {
  const navigate = useNavigate();

  async function onLogout() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main className="home-stub">
      <h1>alco-app</h1>
      <button className="auth-submit home-logout" type="button" onClick={onLogout}>
        ログアウト
      </button>
    </main>
  );
}
