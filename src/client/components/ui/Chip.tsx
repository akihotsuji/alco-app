import type { ReactNode } from "react";
import type { MotionState } from "@/client/lib/motion.ts";
import { cn } from "@/client/lib/utils.ts";

type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** `loading`（M-07）/ `success`（M-08）。1 タップ記録のチップが使う */
  state?: MotionState;
  className?: string;
  onSelect: () => void;
};

/**
 * 選択チップ（spec/screen-designs/00-common.md 2.6）。見た目と M-31 / M-07 / M-08 は
 * styles.css の `.chip` が担い、ここは `is-on` と `data-state` を置くだけ。
 */
export function Chip({
  children,
  selected = false,
  disabled,
  state,
  className,
  onSelect,
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn("chip", selected && "is-on", className)}
      aria-pressed={selected}
      disabled={disabled}
      data-state={state && state !== "idle" ? state : undefined}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
