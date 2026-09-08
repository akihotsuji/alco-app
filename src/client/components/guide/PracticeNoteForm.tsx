import { useState } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { RatingField } from "@/client/components/notes/RatingField.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { guideStepProgress } from "@/client/lib/first-run-guide.ts";
import { DEFAULT_DRINK_TYPE, type DrinkType } from "@/shared/constants.ts";

type PracticeNoteFormProps = {
  onFieldUsed: () => void;
  onSaved: () => void;
};

export function PracticeNoteForm({ onFieldUsed, onSaved }: PracticeNoteFormProps) {
  const guide = useFirstRunGuide();
  const progress = guide.step === "off" ? null : guideStepProgress(guide.step);
  const [drinkName] = useState("練習用");
  const [drinkType, setDrinkType] = useState<DrinkType>(DEFAULT_DRINK_TYPE);
  const [ratingX10, setRatingX10] = useState<number | null>(40);

  return (
    <div className="form-page">
      <p className="guide-practice-banner" role="status">
        <span>練習中・保存されません</span>
        {progress ? (
          <span>
            {progress.current} / {progress.total}
          </span>
        ) : null}
      </p>
      <p className="form-lead">評価して残す。写真はなくても大丈夫です</p>
      <section className="log-form-section">
        <FieldLabel>品名</FieldLabel>
        <Input value={drinkName} readOnly aria-label="品名" />
      </section>
      <DrinkTypeSelect value={drinkType} onChange={setDrinkType} />
      <RatingField
        value={ratingX10}
        guideTarget="rating"
        onChange={(next) => {
          setRatingX10(next);
          onFieldUsed();
        }}
      />
      <SaveBar
        label="練習として保存（記録されません）"
        pending={false}
        disabled={ratingX10 === null}
        hint={ratingX10 === null ? "評価を入力してください" : null}
        state="idle"
        guideTarget="save"
        onSave={onSaved}
      />
    </div>
  );
}
