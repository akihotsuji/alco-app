import { Button } from "@/client/components/ui/button.tsx";
import type { MotionState } from "@/client/lib/motion.ts";

type SaveBarProps = {
  label?: string;
  pending?: boolean;
  disabled?: boolean;
  /** `loading` で水位線（M-04）、失敗直後は `error` で静かに戻す（M-06） */
  state?: MotionState;
  onSave: () => void;
};

export function SaveBar({
  label = "保存する",
  pending = false,
  disabled = false,
  state,
  onSave,
}: SaveBarProps) {
  return (
    <div className="save-bar">
      <Button
        type="button"
        onClick={onSave}
        disabled={disabled || pending}
        state={state ?? (pending ? "loading" : "idle")}
      >
        {pending ? "保存中" : label}
      </Button>
    </div>
  );
}
