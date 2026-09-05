import type { FormEvent, ReactNode } from "react";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { Card, CardContent } from "@/client/components/ui/card.tsx";

type AuthPageLayoutProps = {
  title: string;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageLayout({
  title,
  error,
  onSubmit,
  canSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  children,
  footer,
}: AuthPageLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 py-6">
      <Mascot pose="default" size={120} aria-hidden />
      <p className="mb-6 text-[13px] font-semibold text-muted">alco-app</p>
      <Card className="w-full max-w-[360px] p-6">
        <CardContent>
          <form className="flex flex-col" onSubmit={onSubmit} noValidate>
            <h1 className="mb-4 text-2xl font-semibold leading-[1.3]">{title}</h1>
            {error ? (
              <p className="mb-4 text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {children}
            <Button className="mt-2" type="submit" disabled={!canSubmit}>
              {submitting ? submittingLabel : submitLabel}
            </Button>
            {footer}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
