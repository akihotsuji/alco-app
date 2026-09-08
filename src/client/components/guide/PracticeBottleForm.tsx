import { useState } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { DEFAULT_BOTTLE_DRINK_TYPE } from "@/client/lib/bottle-form.ts";
import { guideStepProgress } from "@/client/lib/first-run-guide.ts";
import type { DrinkType } from "@/shared/constants.ts";

type PracticeBottleFormProps = {
  onFieldUsed: () => void;
  onSaved: () => void;
};

export function PracticeBottleForm({ onFieldUsed, onSaved }: PracticeBottleFormProps) {
  const guide = useFirstRunGuide();
  const progress = guide.step === "off" ? null : guideStepProgress(guide.step);
  const [name] = useState("練習用");
  const [drinkType, setDrinkType] = useState<DrinkType>(DEFAULT_BOTTLE_DRINK_TYPE);

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
      <p className="form-lead">種類を選んで並べる。写真はなくても大丈夫です</p>
      <section className="log-form-section">
        <FieldLabel>品名</FieldLabel>
        <Input value={name} readOnly aria-label="品名" />
      </section>
      <DrinkTypeChips
        value={drinkType}
        guideTarget="drink-type"
        onChange={(next) => {
          setDrinkType(next);
          onFieldUsed();
        }}
      />
      <SaveBar
        label="練習として並べる（保存されません）"
        pending={false}
        disabled={false}
        state="idle"
        guideTarget="save"
        onSave={onSaved}
      />
    </div>
  );
}
