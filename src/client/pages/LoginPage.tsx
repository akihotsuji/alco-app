import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClientErrorMessage } from "@/client/auth/auth-error.ts";
import { hrefWithRedirect } from "@/client/auth/login-path.ts";
import { hasOAuthErrorQuery, stripOAuthErrorParams } from "@/client/auth/oauth.ts";
import { loginNoticeFromSearch } from "@/client/auth/password-reset.ts";
import {
  TURNSTILE_LOAD_ERROR_MESSAGE,
  useTurnstileGate,
} from "@/client/auth/use-turnstile-gate.ts";
import { AuthPageLayout } from "@/client/components/auth/AuthPageLayout.tsx";
import { GoogleSignInButton } from "@/client/components/auth/GoogleSignInButton.tsx";
import { PasswordField } from "@/client/components/auth/PasswordField.tsx";
import { TurnstileField } from "@/client/components/auth/TurnstileField.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { cn } from "@/client/lib/utils.ts";
import { loginFormSchema, resolveSafeRedirect } from "@/shared/auth.ts";
import { GOOGLE_SIGN_IN_VISIBLE, OAUTH_ERROR_MESSAGE } from "@/shared/oauth.ts";
import { turnstileRequestHeaders } from "@/shared/turnstile.ts";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectQuery = searchParams.get("redirect");
  const signupHref = hrefWithRedirect("/signup", redirectQuery);
  const resetNotice = loginNoticeFromSearch(searchParams);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const turnstile = useTurnstileGate();
  const oauthFailed = hasOAuthErrorQuery(searchParams);
  const [error, setError] = useState<string | null>(oauthFailed ? OAUTH_ERROR_MESSAGE : null);

  useEffect(() => {
    if (!oauthFailed) {
      return;
    }
    const next = stripOAuthErrorParams(searchParams);
    const search = next.toString();
    navigate({ pathname: "/login", search: search ? `?${search}` : "" }, { replace: true });
  }, [navigate, oauthFailed, searchParams]);

  const parsed = loginFormSchema.safeParse({
    email: email.trim(),
    password,
  });
  const canSubmit = parsed.success && !submitting && turnstile.canAct;

  function refreshTurnstile() {
    turnstile.setToken(null);
    setWidgetKey((value) => value + 1);
  }

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
      fetchOptions: {
        headers: turnstileRequestHeaders(turnstile.token),
      },
    });
    setSubmitting(false);
    if (result.error) {
      refreshTurnstile();
      setError(
        authClientErrorMessage(result.error.status, "メールまたはパスワードが正しくありません"),
      );
      return;
    }
    navigate(resolveSafeRedirect(redirectQuery), { replace: true });
  }

  return (
    <AuthPageLayout
      title="ログイン"
      notice={resetNotice}
      error={turnstile.blocked ? TURNSTILE_LOAD_ERROR_MESSAGE : error}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
      submitting={submitting}
      submitLabel="ログイン"
      submittingLabel="ログイン中"
      footer={
        <>
          <Link
            className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")}
            to="/forgot-password"
          >
            パスワードを忘れた
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "link" }), "mt-2 self-center")}
            to={signupHref}
          >
            アカウントを作成
          </Link>
          {GOOGLE_SIGN_IN_VISIBLE ? (
            <GoogleSignInButton
              mode="login"
              redirectQuery={redirectQuery}
              acceptedLegal
              disabled={submitting || !turnstile.canAct}
              turnstileToken={turnstile.token}
              onError={setError}
              onBusyChange={setSubmitting}
            />
          ) : null}
        </>
      }
    >
      <Label htmlFor="login-email">メール</Label>
      <Input
        id="login-email"
        className="mb-4"
        type="email"
        autoComplete="email"
        value={email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Label htmlFor="login-password">パスワード</Label>
      <PasswordField
        id="login-password"
        autoComplete="current-password"
        value={password}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={setPassword}
      />
      {turnstile.siteKey ? (
        <TurnstileField
          key={widgetKey}
          siteKey={turnstile.siteKey}
          onTokenChange={turnstile.setToken}
          onLoadError={() => setError(TURNSTILE_LOAD_ERROR_MESSAGE)}
        />
      ) : null}
    </AuthPageLayout>
  );
}
