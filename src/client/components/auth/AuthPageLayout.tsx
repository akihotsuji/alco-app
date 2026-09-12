import type { FormEvent, ReactNode } from "react";
import { Wordmark } from "@/client/components/brand/Wordmark.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { Card, CardContent } from "@/client/components/ui/card.tsx";

type AuthPageLayoutProps = {
  title: string;
  notice?: string | null;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  children: ReactNode;
  footer: ReactNode;
  hideSubmit?: boolean;
};

export function AuthPageLayout({
  title,
  notice = null,
  error,
  onSubmit,
  canSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  children,
  footer,
  hideSubmit = false,
}: AuthPageLayoutProps) {
  return (
    <main className="auth-page">
      <Mascot pose="default" size={120} aria-hidden />
      <Wordmark />
      <Card className="w-full max-w-[360px] p-6">
        <CardContent>
          <form className="flex flex-col" onSubmit={onSubmit} noValidate>
            <h1 className="mb-4 text-2xl font-semibold leading-[1.3]">{title}</h1>
            {notice ? <p className="mb-4 text-base leading-normal">{notice}</p> : null}
            {error ? (
              <p id="auth-form-error" className="mb-4 text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {children}
            {hideSubmit ? null : (
              <Button className="mt-2" type="submit" disabled={!canSubmit}>
                {submitting ? submittingLabel : submitLabel}
              </Button>
            )}
            {footer}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
