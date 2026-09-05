import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { loginFormSchema, resolveSafeRedirect } from "@/shared/auth.ts";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectQuery = searchParams.get("redirect");
  const signupHref = redirectQuery
    ? `/signup?redirect=${encodeURIComponent(redirectQuery)}`
    : "/signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = loginFormSchema.safeParse({
    email: email.trim(),
    password,
  });
  const canSubmit = parsed.success && !submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "しばらく待ってから試してください"
          : "メールまたはパスワードが正しくありません",
      );
      return;
    }
    navigate(resolveSafeRedirect(redirectQuery), { replace: true });
  }

  return (
    <main className="auth-page">
      <Mascot pose="default" size={120} aria-hidden />
      <p className="auth-wordmark">alco-app</p>
      <form className="auth-card" onSubmit={onSubmit} noValidate>
        <h1 className="auth-title">ログイン</h1>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="auth-label" htmlFor="login-email">
          メール
        </label>
        <input
          id="login-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label className="auth-label" htmlFor="login-password">
          パスワード
        </label>
        <div className="auth-password">
          <input
            id="login-password"
            className="auth-input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <button className="auth-submit" type="submit" disabled={!canSubmit}>
          {submitting ? "ログイン中" : "ログイン"}
        </button>
        <Link className="auth-link" to={signupHref}>
          アカウントを作成
        </Link>
      </form>
    </main>
  );
}
