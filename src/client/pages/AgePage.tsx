import { type FormEvent, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { AuthBoot } from "@/client/auth/AuthBoot.tsx";
import { endSession } from "@/client/auth/end-session.ts";
import { AuthPageLayout } from "@/client/components/auth/AuthPageLayout.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useVerifyAge } from "@/client/hooks/use-age-verification.ts";
import { useMe } from "@/client/hooks/use-me.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import {
  BIRTH_ON_PART_MAX_LENGTH,
  type BirthOnParts,
  birthOnPartsLookComplete,
  composeBirthOn,
  EMPTY_BIRTH_ON_PARTS,
  sanitizeBirthOnPart,
  shouldAdvanceBirthOnPart,
} from "@/client/lib/birth-on-input.ts";
import { AGE_BIRTH_ON_MESSAGE } from "@/shared/age.ts";
import { resolveSafeRedirect } from "@/shared/auth.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";

const PART_ORDER: (keyof BirthOnParts)[] = ["year", "month", "day"];
const PART_LABELS: Record<keyof BirthOnParts, string> = { year: "年", month: "月", day: "日" };
const PART_PLACEHOLDERS: Record<keyof BirthOnParts, string> = {
  year: "1990",
  month: "1",
  day: "15",
};
const PART_AUTOCOMPLETE: Record<keyof BirthOnParts, string> = {
  year: "bday-year",
  month: "bday-month",
  day: "bday-day",
};

export function AgePage() {
  const [searchParams] = useSearchParams();
  const me = useMe();
  const verifyAge = useVerifyAge();
  const today = tokyoToday();

  const [parts, setParts] = useState<BirthOnParts>(EMPTY_BIRTH_ON_PARTS);
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<keyof BirthOnParts, HTMLInputElement | null>>({
    year: null,
    month: null,
    day: null,
  });

  const birthOn = composeBirthOn(parts, today);
  const looksComplete = birthOnPartsLookComplete(parts);
  // 入力途中では赤を出さない。全欄が埋まってから日付にならないときだけ案内する
  const partsError = looksComplete && birthOn === null ? AGE_BIRTH_ON_MESSAGE : null;
  const shownError = error ?? partsError;
  const canSubmit = birthOn !== null && !verifyAge.isPending;

  function updatePart(part: keyof BirthOnParts, raw: string) {
    const value = sanitizeBirthOnPart(part, raw);
    setParts((current) => ({ ...current, [part]: value }));
    setError(null);
    if (value.length > 0 && shouldAdvanceBirthOnPart(part, value)) {
      const nextIndex = PART_ORDER.indexOf(part) + 1;
      const next = PART_ORDER[nextIndex];
      if (next) {
        inputRefs.current[next]?.focus();
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || birthOn === null) {
      return;
    }
    setError(null);
    try {
      await verifyAge.mutateAsync(birthOn);
    } catch (caught) {
      if (isApiClientError(caught) && caught.code === "age_restricted") {
        setParts(EMPTY_BIRTH_ON_PARTS);
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
                setParts(EMPTY_BIRTH_ON_PARTS);
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
      error={shownError}
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
      <fieldset className="birth-on-fieldset">
        <legend className="birth-on-legend">生年月日</legend>
        <div className="birth-on-row">
          {PART_ORDER.map((part) => (
            <div key={part} className={`birth-on-part birth-on-part-${part}`}>
              <Input
                id={`age-birth-${part}`}
                ref={(node) => {
                  inputRefs.current[part] = node;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={PART_AUTOCOMPLETE[part]}
                maxLength={BIRTH_ON_PART_MAX_LENGTH[part]}
                placeholder={PART_PLACEHOLDERS[part]}
                value={parts[part]}
                aria-invalid={shownError ? true : undefined}
                aria-describedby={shownError ? "auth-form-error" : undefined}
                onChange={(event) => updatePart(part, event.target.value)}
                required
              />
              <label className="birth-on-unit" htmlFor={`age-birth-${part}`}>
                {PART_LABELS[part]}
              </label>
            </div>
          ))}
        </div>
        <p className="birth-on-hint">例: 1990 年 1 月 15 日</p>
      </fieldset>
    </AuthPageLayout>
  );
}
