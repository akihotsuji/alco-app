import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { Card, CardContent } from "@/client/components/ui/card.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { authClient } from "@/client/lib/auth-client.ts";
import { cn } from "@/client/lib/utils.ts";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 py-6">
      <Mascot pose="default" size={120} aria-hidden />
      <p className="mb-6 text-[13px] font-semibold text-muted">alco-app</p>
      <Card className="w-full max-w-[360px] p-6">
        <CardContent>
          <form className="flex flex-col" onSubmit={onSubmit} noValidate>
            <h1 className="mb-4 text-2xl font-semibold leading-[1.3]">アカウント作成</h1>
            {error ? (
              <p className="mb-4 text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Label htmlFor="signup-name">表示名</Label>
            <Input
              id="signup-name"
              className="mb-4"
              type="text"
              autoComplete="name"
              maxLength={AUTH_NAME_MAX_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Label htmlFor="signup-email">メール</Label>
            <Input
              id="signup-email"
              className="mb-4"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Label htmlFor="signup-password">
              パスワード（{AUTH_PASSWORD_MIN_LENGTH} 文字以上）
            </Label>
            <div className="auth-password mb-4">
              <Input
                id="signup-password"
                className="pr-[52px]"
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
            <Button className="mt-2" type="submit" disabled={!canSubmit}>
              {submitting ? "登録中" : "登録する"}
            </Button>
            <Link
              className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")}
              to={loginHref}
            >
              ログインへ
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
