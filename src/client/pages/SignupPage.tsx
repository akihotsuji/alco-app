import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import {
  AUTH_NAME_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  resolveSafeRedirect,
  signupFormSchema,
} from "@/shared/auth.ts";

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectQuery = searchParams.get("redirect");
  const loginHref = redirectQuery
    ? `/login?redirect=${encodeURIComponent(redirectQuery)}`
    : "/login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = signupFormSchema.safeParse({
    name: name.trim(),
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
    const result = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "しばらく待ってから試してください"
          : "登録できませんでした。入力内容を確認してください",
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
        <h1 className="auth-title">アカウント作成</h1>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="auth-label" htmlFor="signup-name">
          表示名
        </label>
        <input
          id="signup-name"
          className="auth-input"
          type="text"
          autoComplete="name"
          maxLength={AUTH_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="auth-label" htmlFor="signup-email">
          メール
        </label>
        <input
          id="signup-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label className="auth-label" htmlFor="signup-password">
          パスワード（{AUTH_PASSWORD_MIN_LENGTH} 文字以上）
        </label>
        <div className="auth-password">
          <input
            id="signup-password"
            className="auth-input"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={AUTH_PASSWORD_MIN_LENGTH}
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
          {submitting ? "登録中" : "登録する"}
        </button>
        <Link className="auth-link" to={loginHref}>
          ログインへ
        </Link>
      </form>
    </main>
  );
}
