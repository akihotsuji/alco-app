import { useState } from "react";
import { useNavigate } from "react-router";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useCellarSync } from "@/client/hooks/use-cellar-sync.ts";
import { cellarDisplayName, cellarPeopleLabel } from "@/client/lib/cellar-share.ts";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { Users } from "lucide-react";
import type { CellarSummary } from "@/shared/cellars.ts";

type CellarSwitcherProps = {
  sync?: boolean;
};

export function CellarSwitcher({ sync = true }: CellarSwitcherProps) {
  const navigate = useNavigate();
  const { items, selected, shared, isPending, select } = useCellarSelection();
  const syncState = useCellarSync(selected?.id, sync && Boolean(selected));
  const [open, setOpen] = useState(false);

  const name = selected ? cellarDisplayName(selected) : "セラー";
  const people = selected ? cellarPeopleLabel(selected) : "";

  function choose(cellar: CellarSummary) {
    select(cellar);
    setOpen(false);
  }

  return (
    <div className="cellar-switcher">
      <button
        type="button"
        className="cellar-switcher-row"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="cellar-switcher-name">
          {isPending ? "セラー" : name} ▾
        </span>
        {people ? (
          <span className="cellar-switcher-people">
            <Users size={16} aria-hidden />
            {people}
          </span>
        ) : null}
      </button>
      {syncState.notice ? (
        <p className="cellar-sync-notice" role="status">
          {syncState.notice.message}
          {syncState.notice.kind === "failed" ? (
            <button type="button" className="cellar-sync-retry" onClick={syncState.retry}>
              再試行
            </button>
          ) : null}
        </p>
      ) : null}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent className="app-sheet-panel">
          <DialogTitle>表示するセラー</DialogTitle>
          <DialogDescription className="visually-hidden">
            自分のセラーと共有セラーを切り替えます
          </DialogDescription>
          <ul className="cellar-switcher-list">
            {items.map((cellar) => {
              const current = cellar.id === selected?.id;
              return (
                <li key={cellar.id}>
                  <button
                    type="button"
                    className={current ? "cellar-switcher-item is-on" : "cellar-switcher-item"}
                    onClick={() => choose(cellar)}
                  >
                    <span>
                      <strong>{cellarDisplayName(cellar)}</strong>
                      <span className="cellar-switcher-item-meta">{cellarPeopleLabel(cellar)}</span>
                    </span>
                    {current ? <span className="cellar-switcher-check">選択中</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {shared ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                navigate("/cellar/share/settings");
              }}
            >
              共有設定
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                navigate("/cellar/share");
              }}
            >
              セラーを共有する
            </Button>
          )}
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
