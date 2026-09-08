import { Button } from "@/client/components/ui/button.tsx";
import type { MotionState } from "@/client/lib/motion.ts";

type SaveBarProps = {
  label?: string;
  pending?: boolean;
  disabled?: boolean;
  hint?: string | null;
  /** `loading` で水位線（M-04）、失敗直後は `error` で静かに戻す（M-06） */
  state?: MotionState;
  guideTarget?: string;
  onSave: () => void;
};

export function SaveBar({
  label = "保存する",
  pending = false,
  disabled = false,
  hint = null,
  state,
  guideTarget,
  onSave,
}: SaveBarProps) {
  return (
    <div className="save-bar" data-guide-target={guideTarget}>
      {hint ? <p className="save-bar-hint">{hint}</p> : null}
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
