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
  onNote: () => void;
  onClose: () => void;
};

export function OpenedFollowupSheet({ open, onLog, onNote, onClose }: OpenedFollowupSheetProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
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
        <Button type="button" onClick={onLog}>
          飲んだ量を記録
        </Button>
        <Button type="button" variant="secondary" onClick={onNote}>
          テイスティングノートを書く
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          今はしない
        </Button>
      </DialogContent>
    </DialogRoot>
  );
}
