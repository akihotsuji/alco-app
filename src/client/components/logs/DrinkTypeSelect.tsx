import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { AiMarkPill } from "@/client/components/form/FieldWithAiMark.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import { DRINK_TYPE_LABELS, DRINK_TYPES, type DrinkType } from "@/shared/constants.ts";

type DrinkTypeSelectProps = {
  value: DrinkType | null;
  onChange: (drinkType: DrinkType) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  /** AI が写真から選んだ（行に AI ピル） */
  aiMarked?: boolean;
  /** 読み取り中で AI が選ぶ可能性がある（行に「読み取り中」ピル） */
  aiPending?: boolean;
};

/** 種類セレクト。全 12 種へアクセスする。横スクロールに頼らない */
export function DrinkTypeSelect({
  value,
  onChange,
  required = false,
  placeholder = "種類を選択",
  error,
  aiMarked = false,
  aiPending = false,
}: DrinkTypeSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="log-form-section">
      <FieldLabel required={required}>種類</FieldLabel>
      <button
        type="button"
        className="form-select-row"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen(true)}
      >
        <span className={value ? "form-select-value" : "form-select-placeholder"}>
          {value ? DRINK_TYPE_LABELS[value] : placeholder}
        </span>
        <AiMarkPill marked={aiMarked} pending={aiPending} />
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
      </button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>種類</DialogTitle>
          <DialogDescription>お酒の種類を選びます</DialogDescription>
          <div className="chip-row chip-row-wrap drink-type-options">
            {DRINK_TYPES.map((type) => (
              <Chip
                key={type}
                selected={type === value}
                onSelect={() => {
                  if (type !== value) {
                    haptic("light");
                    onChange(type);
                  }
                  setOpen(false);
                }}
              >
                {DRINK_TYPE_LABELS[type]}
              </Chip>
            ))}
          </div>
        </DialogContent>
      </DialogRoot>
    </section>
  );
}
