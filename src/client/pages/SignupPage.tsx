import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ageGatePath } from "@/client/auth/age-path.ts";
import { authClientErrorMessage } from "@/client/auth/auth-error.ts";
import { hrefWithRedirect } from "@/client/auth/login-path.ts";
import { hasOAuthErrorQuery, stripOAuthErrorParams } from "@/client/auth/oauth.ts";
import { AuthPageLayout } from "@/client/components/auth/AuthPageLayout.tsx";
import { GoogleSignInButton } from "@/client/components/auth/GoogleSignInButton.tsx";
import { PasswordField } from "@/client/components/auth/PasswordField.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { cn } from "@/client/lib/utils.ts";
import { AUTH_NAME_MAX_LENGTH, AUTH_PASSWORD_MIN_LENGTH, signupFormSchema } from "@/shared/auth.ts";
import { LEGAL_VERSION, legalHref } from "@/shared/legal.ts";
import { OAUTH_SIGNUP_ERROR_MESSAGE } from "@/shared/oauth.ts";

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectQuery = searchParams.get("redirect");
  const loginHref = hrefWithRedirect("/login", redirectQuery);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const oauthFailed = hasOAuthErrorQuery(searchParams);
  const [error, setError] = useState<string | null>(
    oauthFailed ? OAUTH_SIGNUP_ERROR_MESSAGE : null,
  );

  useEffect(() => {
    if (!oauthFailed) {
      return;
    }
    const next = stripOAuthErrorParams(searchParams);
    const search = next.toString();
    navigate({ pathname: "/signup", search: search ? `?${search}` : "" }, { replace: true });
  }, [navigate, oauthFailed, searchParams]);

  const parsed = signupFormSchema.safeParse({
    name: name.trim(),
    email: email.trim(),
    password,
    acceptedLegal,
  });
  const canSubmit = parsed.success && !submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const signupInput = {
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      acceptedLegal: true,
      legalVersion: LEGAL_VERSION,
    };
    const result = await authClient.signUp.email(signupInput);
    setSubmitting(false);
    if (result.error) {
      setError(
        authClientErrorMessage(
          result.error.status,
          "登録できませんでした。入力内容を確認してください",
        ),
      );
      return;
    }
    navigate(ageGatePath(redirectQuery), { replace: true });
  }

  return (
    <AuthPageLayout
      title="アカウント作成"
      error={error}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
      submitting={submitting}
      submitLabel="登録する"
      submittingLabel="登録中"
      footer={
        <>
          <GoogleSignInButton
            mode="signup"
            redirectQuery={redirectQuery}
            acceptedLegal={acceptedLegal}
            disabled={submitting}
            onError={setError}
            onBusyChange={setSubmitting}
          />
          <Link
            className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")}
            to={loginHref}
          >
            ログインへ
          </Link>
        </>
      }
    >
      <Label htmlFor="signup-name">表示名</Label>
      <Input
        id="signup-name"
        className="mb-4"
        type="text"
        autoComplete="name"
        maxLength={AUTH_NAME_MAX_LENGTH}
        value={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={(event) => setName(event.target.value)}
      />
      <Label htmlFor="signup-email">メール</Label>
      <Input
        id="signup-email"
        className="mb-4"
        type="email"
        autoComplete="email"
        value={email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <Label htmlFor="signup-password">パスワード（{AUTH_PASSWORD_MIN_LENGTH} 文字以上）</Label>
      <PasswordField
        id="signup-password"
        autoComplete="new-password"
        minLength={AUTH_PASSWORD_MIN_LENGTH}
        value={password}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={setPassword}
      />
      <div className="signup-legal">
        <input
          id="signup-legal"
          type="checkbox"
          checked={acceptedLegal}
          onChange={(event) => setAcceptedLegal(event.target.checked)}
        />
        <label htmlFor="signup-legal">利用規約とプライバシーポリシーに同意する</label>
        <p className="signup-legal-links">
          <Link to={legalHref("/terms", "signup")}>利用規約</Link>
          <Link to={legalHref("/privacy", "signup")}>プライバシーポリシー</Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
