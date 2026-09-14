import { type RefObject, useEffect, useRef } from "react";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";

export type PhotoActionItem = {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type PhotoActionPanelProps = {
  open: boolean;
  title: string;
  description?: string;
  actions: readonly PhotoActionItem[];
  restoreFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
};

/** 写真操作の選択パネル。閉じたら呼び出し元へフォーカスを戻す */
export function PhotoActionPanel({
  open,
  title,
  description = "写真の操作を選びます",
  actions,
  restoreFocus,
  onClose,
}: PhotoActionPanelProps) {
  const restored = useRef(false);

  useEffect(() => {
    if (open) {
      restored.current = false;
    }
  }, [open]);

  function returnFocus() {
    window.requestAnimationFrame(() => restoreFocus.current?.focus());
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          if (!restored.current) {
            restored.current = true;
            returnFocus();
          }
        }
      }}
    >
      <DialogContent className="photo-action-panel">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="visually-hidden">{description}</DialogDescription>
        <ul className="photo-action-panel-list">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                className={
                  action.danger ? "photo-action-panel-item is-danger" : "photo-action-panel-item"
                }
                disabled={action.disabled}
                onClick={() => {
                  onClose();
                  restored.current = true;
                  action.onSelect();
                  returnFocus();
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </DialogRoot>
  );
}
