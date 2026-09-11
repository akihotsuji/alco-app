import { Users } from "lucide-react";
import { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { cellarDisplayName, cellarPeopleLabel } from "@/client/lib/cellar-share.ts";
import type { CellarSummary } from "@/shared/cellars.ts";
import { CELLAR_COPY } from "@/shared/cellars.ts";

type CellarDestinationFieldProps = {
  items: readonly CellarSummary[];
  valueId: string | undefined;
  locked?: boolean;
  disabled?: boolean;
  onChange?: (cellar: CellarSummary) => void;
};

export function CellarDestinationField({
  items,
  valueId,
  locked = false,
  disabled = false,
  onChange,
}: CellarDestinationFieldProps) {
  const [open, setOpen] = useState(false);
  const current = items.find((item) => item.id === valueId) ?? items[0];
  if (!current) {
    return null;
  }
  const shared = current.kind === "shared";
  const canChange = !locked && !disabled && Boolean(onChange) && items.length > 1;

  return (
    <section className="cellar-destination">
      <button
        type="button"
        className="cellar-destination-row"
        disabled={!canChange}
        onClick={() => {
          if (canChange) {
            setOpen(true);
          }
        }}
      >
        <span>
          保存先：{cellarDisplayName(current)}
          {canChange ? " ▾" : null}
        </span>
        {shared ? (
          <span className="cellar-destination-people">
            <Users size={16} aria-hidden />
            {cellarPeopleLabel(current)}
          </span>
        ) : null}
      </button>
      {shared ? <p className="field-hint">{CELLAR_COPY.saveDestinationShared}</p> : null}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent className="app-sheet-panel">
          <DialogTitle>保存先</DialogTitle>
          <DialogDescription className="visually-hidden">
            保存するセラーを選びます
          </DialogDescription>
          <ul className="cellar-switcher-list">
            {items.map((cellar) => (
              <li key={cellar.id}>
                <button
                  type="button"
                  className={
                    cellar.id === current.id ? "cellar-switcher-item is-on" : "cellar-switcher-item"
                  }
                  onClick={() => {
                    onChange?.(cellar);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong>{cellarDisplayName(cellar)}</strong>
                    <span className="cellar-switcher-item-meta">{cellarPeopleLabel(cellar)}</span>
                  </span>
                  {cellar.id === current.id ? (
                    <span className="cellar-switcher-check">選択中</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </DialogRoot>
    </section>
  );
}
