import { useRef } from "react";
import { Link } from "react-router";
import { Mascot, type MascotPose } from "@/client/components/mascot/Mascot.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { cn } from "@/client/lib/utils.ts";

type EmptyStateProps = {
  pose: MascotPose;
  message: string;
  detail?: string;
  actionLabel?: string;
  actionTo?: string;
  actionVariant?: "primary" | "secondary";
  onAction?: () => void;
};

/** M-26 / M-27 は同じ空状態を再表示しても再生しない（セッション内で 1 回。motion-design 6.7） */
const played = new Set<string>();

export function shouldPlayEmptyEnter(key: string, registry: Set<string> = played): boolean {
  if (registry.has(key)) {
    return false;
  }
  registry.add(key);
  return true;
}

export function EmptyState({
  pose,
  message,
  detail,
  actionLabel,
  actionTo,
  actionVariant = "primary",
  onAction,
}: EmptyStateProps) {
  const variant = actionVariant === "secondary" ? "secondary" : "default";
  const enterRef = useRef<boolean | null>(null);
  if (enterRef.current === null) {
    enterRef.current = shouldPlayEmptyEnter(`${pose}:${message}`);
  }

  return (
    <div className="empty-state" data-enter={enterRef.current ? "1" : undefined}>
      <span className="empty-state-mascot">
        <Mascot pose={pose} size={96} aria-hidden />
      </span>
      <p className="empty-state-message">{message}</p>
      {detail ? <p className="empty-state-detail">{detail}</p> : null}
      {actionLabel && actionTo ? (
        <Link className={cn(buttonVariants({ variant }), "empty-action")} to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionTo ? (
        <Button className="empty-action" variant={variant} type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
