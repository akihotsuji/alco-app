import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";

type DialogProps = {
  open: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onPrimary: () => void;
  onClose: () => void;
};

export function Dialog({
  open,
  title,
  body,
  primaryLabel,
  destructive = false,
  pending = false,
  onPrimary,
  onClose,
}: DialogProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        aria-describedby="app-dialog-body"
        onInteractOutside={(event) => {
          if (destructive) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (destructive) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
          {title}
        </DialogTitle>
        <DialogDescription id="app-dialog-body" className="text-base text-foreground">
          {body}
        </DialogDescription>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          onClick={onPrimary}
          disabled={pending}
        >
          {pending ? "処理中" : primaryLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          キャンセル
        </Button>
      </DialogContent>
    </DialogRoot>
  );
}
