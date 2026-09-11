import { useMemo, useState } from "react";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { type ConflictField, conflictFields } from "@/client/lib/cellar-share.ts";
import type { Bottle } from "@/shared/bottles.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";

type BottleConflictDialogProps = {
  open: boolean;
  initial: Bottle;
  mine: Bottle;
  current: Bottle;
  onApply: (next: Bottle, photoChoice: "current" | "mine") => void;
  onClose: () => void;
};

export function BottleConflictDialog({
  open,
  initial,
  mine,
  current,
  onApply,
  onClose,
}: BottleConflictDialogProps) {
  const fields = useMemo(
    () => conflictFields({ initial, mine, current }),
    [current, initial, mine],
  );
  const [choices, setChoices] = useState<Record<string, "current" | "mine">>({});

  function choiceOf(field: ConflictField): "current" | "mine" {
    if (!field.bothChanged) {
      return field.prefer;
    }
    return choices[field.key] ?? "current";
  }

  function apply() {
    const next: Bottle = { ...current };
    let photoChoice: "current" | "mine" = "current";
    for (const field of fields) {
      const picked = field.bothChanged ? (choices[field.key] ?? "current") : choiceOf(field);
      if (field.key === "photo") {
        photoChoice = picked;
        continue;
      }
      if (picked === "mine") {
        (next as Record<string, unknown>)[field.key] = mine[field.key];
      }
    }
    onApply(next, photoChoice);
  }

  return (
    <DialogRoot open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="app-dialog-panel cellar-conflict-panel">
        <DialogTitle>変更を確認</DialogTitle>
        <DialogDescription className="text-base text-foreground" style={{ textAlign: "left" }}>
          {CELLAR_COPY.conflictEdit}
        </DialogDescription>
        <ul className="cellar-conflict-list">
          {fields.map((field) => (
            <li key={field.key} className="cellar-conflict-item">
              <p className="cellar-conflict-label">{field.label}</p>
              {field.bothChanged ? (
                <div className="cellar-conflict-choices">
                  <label>
                    <input
                      type="radio"
                      name={`conflict-${field.key}`}
                      checked={choiceOf(field) === "current"}
                      onChange={() =>
                        setChoices((currentChoices) => ({
                          ...currentChoices,
                          [field.key]: "current",
                        }))
                      }
                    />
                    現在の値：{field.current}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`conflict-${field.key}`}
                      checked={choiceOf(field) === "mine"}
                      onChange={() =>
                        setChoices((currentChoices) => ({ ...currentChoices, [field.key]: "mine" }))
                      }
                    />
                    自分の入力：{field.mine}
                  </label>
                </div>
              ) : (
                <p className="cellar-conflict-single">
                  {choiceOf(field) === "mine"
                    ? `自分の入力：${field.mine}`
                    : `現在の値：${field.current}`}
                </p>
              )}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={apply}>
          確認して続ける
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          閉じる
        </Button>
      </DialogContent>
    </DialogRoot>
  );
}
