import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";

type OpenedFollowupSheetProps = {
  open: boolean;
  onLog: () => void;
  onClose: (shareOpening: boolean) => void;
  shared?: boolean;
  canShare?: boolean;
  shareOn?: boolean;
  onShareOnChange?: (value: boolean) => void;
};

export function OpenedFollowupSheet({
  open,
  onLog,
  onClose,
  shared = false,
  canShare = false,
  shareOn = false,
  onShareOnChange,
}: OpenedFollowupSheetProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose(false);
        }
      }}
    >
      <DialogContent className="app-sheet-panel">
        <DialogTitle className="text-[length:var(--text-title)] font-semibold leading-[1.3]">
          開栓しました
        </DialogTitle>
        <DialogDescription className="text-base text-foreground">
          このボトルについて残しますか？
        </DialogDescription>
        {canShare ? (
          <label className="share-field-hint">
            <input
              type="checkbox"
              checked={shareOn}
              onChange={(event) => onShareOnChange?.(event.target.checked)}
            />
            友達に共有
          </label>
        ) : null}
        <Button type="button" onClick={onLog}>
          {shared ? "自分の飲酒記録をつける" : "飲んだ量を記録"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onClose(shareOn && canShare)}>
          今はしない
        </Button>
      </DialogContent>
    </DialogRoot>
  );
}
