import { ChevronDown, Users } from "lucide-react";
import { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { cellarDisplayName, cellarPeopleLabel } from "@/client/lib/cellar-share.ts";
import { CELLAR_COPY, type CellarSummary } from "@/shared/cellars.ts";

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
  const name = cellarDisplayName(current);

  return (
    <section className="cellar-destination">
      {canChange ? (
        <button
          type="button"
          className="cellar-destination-card is-action"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <DestinationBody name={name} shared={shared} current={current} showChevron />
        </button>
      ) : (
        <div className="cellar-destination-card">
          <DestinationBody name={name} shared={shared} current={current} />
        </div>
      )}
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

function DestinationBody({
  name,
  shared,
  current,
  showChevron = false,
}: {
  name: string;
  shared: boolean;
  current: CellarSummary;
  showChevron?: boolean;
}) {
  return (
    <>
      <span className="cellar-destination-label">保存先</span>
      <span className="cellar-destination-name">
        {name}
        {showChevron ? <ChevronDown size={20} aria-hidden /> : null}
      </span>
      {shared ? (
        <span className="cellar-destination-people">
          <Users size={16} aria-hidden />
          {cellarPeopleLabel(current)}
        </span>
      ) : null}
      {shared ? (
        <span className="cellar-destination-shared-copy">{CELLAR_COPY.saveDestinationShared}</span>
      ) : null}
    </>
  );
}
