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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 py-6">
      <Mascot pose="default" size={120} aria-hidden />
      <p className="mb-6 text-[13px] font-semibold text-muted">alco-app</p>
      <Card className="w-full max-w-[360px] p-6">
        <CardContent>
          <form className="flex flex-col" onSubmit={onSubmit} noValidate>
            <h1 className="mb-4 text-2xl font-semibold leading-[1.3]">ログイン</h1>
            {error ? (
              <p className="mb-4 text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <Label htmlFor="login-email">メール</Label>
            <Input
              id="login-email"
              className="mb-4"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Label htmlFor="login-password">パスワード</Label>
            <div className="auth-password mb-4">
              <Input
                id="login-password"
                className="pr-[52px]"
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
            <Button className="mt-2" type="submit" disabled={!canSubmit}>
              {submitting ? "ログイン中" : "ログイン"}
            </Button>
            <Link
              className={cn(buttonVariants({ variant: "link" }), "mt-4 self-center")}
              to={signupHref}
            >
              アカウントを作成
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
