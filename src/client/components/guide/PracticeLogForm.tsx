import { useState } from "react";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { guideStepProgress } from "@/client/lib/first-run-guide.ts";
import {
  applyDrinkType,
  canSubmitLogForm,
  initialLogFormState,
  type LogFormField,
  validateLogForm,
  visibleLogFormErrors,
} from "@/client/lib/log-form.ts";

type PracticeLogFormProps = {
  onFieldUsed: () => void;
  onSaved: () => void;
};

export function PracticeLogForm({ onFieldUsed, onSaved }: PracticeLogFormProps) {
  const guide = useFirstRunGuide();
  const progress = guide.step === "off" ? null : guideStepProgress(guide.step);
  const [now] = useState(() => new Date());
  const [state, setState] = useState(() => initialLogFormState(null, now));
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LogFormField, boolean>>>({});
  const errors = validateLogForm(state, now);
  const visibleErrors = visibleLogFormErrors(errors, { submitted, touched });
  const canSubmit = canSubmitLogForm(state, errors, "none");

  function update(patch: Partial<typeof state>, field?: LogFormField) {
    if (field) {
      setTouched((current) => ({ ...current, [field]: true }));
    }
    setState((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="form-page log-form">
      <p className="guide-practice-banner" role="status">
        <span>練習中・保存されません</span>
        {progress ? (
          <span>
            {progress.current} / {progress.total}
          </span>
        ) : null}
      </p>
      <DrinkTypeSelect
        value={state.drinkType}
        onChange={(drinkType) => setState((current) => applyDrinkType(current, drinkType))}
      />
      <VolumeField
        key={`practice-volume-${state.drinkType}`}
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={visibleErrors.volumeMl}
        guideTarget={guide.step === "practice-volume" ? "volume" : undefined}
        onChange={(volumeMl) => {
          update({ volumeMl }, "volumeMl");
          onFieldUsed();
        }}
      />
      <AbvField
        key={`practice-abv-${state.drinkType}`}
        value={state.abvPercent}
        volumeMl={state.volumeMl}
        error={visibleErrors.abvPercent}
        onChange={(abvPercent) => update({ abvPercent }, "abvPercent")}
      />
      <DrunkAtRow
        value={state.drunkAt}
        now={now}
        error={visibleErrors.drunkAt}
        onChange={(drunkAt) => update({ drunkAt }, "drunkAt")}
      />
      <SaveBar
        label="練習として保存（記録されません）"
        pending={false}
        disabled={!canSubmit}
        hint={!canSubmit ? "量と度数を入力してください" : null}
        state="idle"
        guideTarget={guide.step === "practice-save" ? "save" : undefined}
        onSave={() => {
          setSubmitted(true);
          if (canSubmit) {
            onSaved();
          }
        }}
      />
    </div>
  );
}
