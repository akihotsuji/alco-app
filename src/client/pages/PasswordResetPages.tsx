import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { authClientErrorMessage } from "@/client/auth/auth-error.ts";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isInvalidResetLink,
  RESET_PASSWORD_INVALID_MESSAGE,
  RESET_PASSWORD_MISMATCH_MESSAGE,
  readResetToken,
  shouldStripResetQuery,
} from "@/client/auth/password-reset.ts";
import {
  TURNSTILE_LOAD_ERROR_MESSAGE,
  useTurnstileGate,
} from "@/client/auth/use-turnstile-gate.ts";
import { AuthPageLayout } from "@/client/components/auth/AuthPageLayout.tsx";
import { TurnstileField } from "@/client/components/auth/TurnstileField.tsx";
import { PasswordField } from "@/client/components/auth/PasswordField.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { cn } from "@/client/lib/utils.ts";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  FORGOT_PASSWORD_PATH,
  forgotPasswordFormSchema,
  RESET_PASSWORD_PATH,
  resetPasswordFormSchema,
} from "@/shared/auth.ts";
import { turnstileRequestHeaders } from "@/shared/turnstile.ts";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [widgetKey, setWidgetKey] = useState(0);
  const turnstile = useTurnstileGate();
  const [error, setError] = useState<string | null>(null);

  const parsed = forgotPasswordFormSchema.safeParse({ email: email.trim() });
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
    const result = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: RESET_PASSWORD_PATH,
      fetchOptions: {
        headers: turnstileRequestHeaders(turnstile.token),
      },
    });
    setSubmitting(false);
    if (result.error) {
      refreshTurnstile();
      setError(
        authClientErrorMessage(
          result.error.status,
          "送信できませんでした。時間をおいて再度お試しください",
        ),
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthPageLayout
        title="パスワード再設定"
        error={null}
        onSubmit={(event) => event.preventDefault()}
        canSubmit={false}
        submitting={false}
        submitLabel="送信する"
        submittingLabel="送信中"
        hideSubmit
        footer={
          <Link className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")} to="/login">
            ログインへ
          </Link>
        }
      >
        <p className="mb-4 text-base leading-normal">{FORGOT_PASSWORD_SUCCESS_MESSAGE}</p>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="パスワード再設定"
      error={turnstile.blocked ? TURNSTILE_LOAD_ERROR_MESSAGE : error}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
      submitting={submitting}
      submitLabel="送信する"
      submittingLabel="送信中"
      footer={
        <Link className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")} to="/login">
          ログインへ
        </Link>
      }
    >
      <p className="mb-4 text-base leading-normal">
        登録したメールアドレスを入力してください。登録がある場合は、再設定用の案内を送ります。
      </p>
      <Label htmlFor="forgot-email">メール</Label>
      <Input
        id="forgot-email"
        className="mb-4"
        type="email"
        autoComplete="email"
        value={email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={(event) => setEmail(event.target.value)}
        required
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

type ResetLocationState = {
  token?: string;
};

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateToken =
    typeof (location.state as ResetLocationState | null)?.token === "string"
      ? (location.state as ResetLocationState).token
      : undefined;
  const [token] = useState(() => readResetToken(searchParams) ?? stateToken ?? null);
  const [invalid] = useState(
    () => isInvalidResetLink(searchParams) || !(readResetToken(searchParams) ?? stateToken),
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shouldStripResetQuery(searchParams)) {
      navigate(RESET_PASSWORD_PATH, { replace: true, state: { token } });
    }
  }, [navigate, searchParams, token]);

  const parsed = resetPasswordFormSchema.safeParse({ password, confirmPassword });
  const mismatch =
    password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = parsed.success && !submitting && Boolean(token);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success || !token) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await authClient.resetPassword({
      newPassword: parsed.data.password,
      token,
    });
    setSubmitting(false);
    if (result.error) {
      if (result.error.status === 429) {
        setError(authClientErrorMessage(429, ""));
        return;
      }
      setError(RESET_PASSWORD_INVALID_MESSAGE);
      return;
    }
    navigate("/login?reset=1", { replace: true });
  }

  if (invalid || !token) {
    return (
      <AuthPageLayout
        title="リンクが無効です"
        error={null}
        onSubmit={(event) => event.preventDefault()}
        canSubmit={false}
        submitting={false}
        submitLabel="変更する"
        submittingLabel="変更中"
        hideSubmit
        footer={
          <Link
            className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")}
            to={FORGOT_PASSWORD_PATH}
          >
            再設定メールを送る
          </Link>
        }
      >
        <p className="mb-4 text-base leading-normal">{RESET_PASSWORD_INVALID_MESSAGE}</p>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="新しいパスワード"
      error={error ?? (mismatch ? RESET_PASSWORD_MISMATCH_MESSAGE : null)}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
      submitting={submitting}
      submitLabel="変更する"
      submittingLabel="変更中"
      footer={
        <Link className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")} to="/login">
          ログインへ
        </Link>
      }
    >
      <p className="mb-4 text-base leading-normal">
        リンクの案内に沿って、新しいパスワードを設定してください。
      </p>
      <Label htmlFor="reset-password">パスワード（{AUTH_PASSWORD_MIN_LENGTH} 文字以上）</Label>
      <PasswordField
        id="reset-password"
        autoComplete="new-password"
        minLength={AUTH_PASSWORD_MIN_LENGTH}
        value={password}
        aria-invalid={error || mismatch ? true : undefined}
        aria-describedby={error || mismatch ? "auth-form-error" : undefined}
        onChange={setPassword}
      />
      <Label htmlFor="reset-password-confirm">パスワード（確認）</Label>
      <PasswordField
        id="reset-password-confirm"
        autoComplete="new-password"
        minLength={AUTH_PASSWORD_MIN_LENGTH}
        value={confirmPassword}
        aria-invalid={error || mismatch ? true : undefined}
        aria-describedby={error || mismatch ? "auth-form-error" : undefined}
        onChange={setConfirmPassword}
      />
    </AuthPageLayout>
  );
}
