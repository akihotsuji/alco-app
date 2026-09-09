import { type FormEvent, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import { endSession } from "@/client/auth/end-session.ts";
import { AuthPageLayout } from "@/client/components/auth/AuthPageLayout.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { Label } from "@/client/components/ui/label.tsx";
import { useVerifyAge } from "@/client/hooks/use-age-verification.ts";
import { useMe } from "@/client/hooks/use-me.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { AGE_BIRTH_ON_MESSAGE, AGE_BIRTH_YEAR_MIN } from "@/shared/age.ts";
import { resolveSafeRedirect } from "@/shared/auth.ts";
import { parseCalendarDate, tokyoToday } from "@/shared/tokyo-date.ts";

export function AgePage() {
  const [searchParams] = useSearchParams();
  const me = useMe();
  const verifyAge = useVerifyAge();
  const today = tokyoToday();
  const minBirthOn = `${AGE_BIRTH_YEAR_MIN}-01-01`;

  const [birthOn, setBirthOn] = useState("");
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseCalendarDate(birthOn);
  const canSubmit = Boolean(
    parsed && parsed.year >= AGE_BIRTH_YEAR_MIN && birthOn <= today && !verifyAge.isPending,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setError(null);
    try {
      await verifyAge.mutateAsync(birthOn);
    } catch (caught) {
      if (isApiClientError(caught) && caught.code === "age_restricted") {
        setBirthOn("");
        setRejected(true);
        return;
      }
      if (isApiClientError(caught) && caught.code === "validation_error") {
        setError(AGE_BIRTH_ON_MESSAGE);
        return;
      }
      setError("確認できませんでした。時間をおいて再度お試しください");
    }
  }

  if (me.isPending) {
    return <AuthBoot />;
  }
  if (me.data?.ageVerified) {
    return <Navigate to={resolveSafeRedirect(searchParams.get("redirect"))} replace />;
  }

  if (rejected) {
    return (
      <AuthPageLayout
        title="ご利用いただけません"
        error={null}
        onSubmit={(event) => event.preventDefault()}
        canSubmit={false}
        submitting={false}
        submitLabel="確認する"
        submittingLabel="確認中"
        hideSubmit
        footer={
          <>
            <Button
              className="mt-2"
              type="button"
              variant="secondary"
              onClick={() => {
                setRejected(false);
                setError(null);
                setBirthOn("");
              }}
            >
              生年月日を修正
            </Button>
            <Button
              className="mt-4"
              type="button"
              variant="ghost"
              onClick={() => void endSession()}
            >
              ログアウト
            </Button>
          </>
        }
      >
        <p className="mb-4 text-base leading-normal">
          20歳未満の方は本サービスをご利用いただけません。
        </p>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="年齢確認"
      error={error}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
      submitting={verifyAge.isPending}
      submitLabel="確認する"
      submittingLabel="確認中"
      footer={
        <Button
          className="mt-4 self-center"
          type="button"
          variant="ghost"
          onClick={() => void endSession()}
        >
          ログアウト
        </Button>
      }
    >
      <p className="mb-4 text-base leading-normal">
        酒類の記録のため、20歳以上の方のみ利用できます。
      </p>
      <Label htmlFor="age-birth-on">生年月日</Label>
      <Input
        id="age-birth-on"
        className="mb-4"
        type="date"
        autoComplete="bday"
        min={minBirthOn}
        max={today}
        value={birthOn}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-form-error" : undefined}
        onChange={(event) => setBirthOn(event.target.value)}
        required
      />
    </AuthPageLayout>
  );
}
