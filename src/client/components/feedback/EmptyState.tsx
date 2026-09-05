import { Link } from "react-router";
import { Mascot, type MascotPose } from "@/client/components/mascot/Mascot.tsx";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { cn } from "@/client/lib/utils.ts";

type EmptyStateProps = {
  pose: MascotPose;
  message: string;
  actionLabel?: string;
  actionTo?: string;
  actionVariant?: "primary" | "secondary";
  onAction?: () => void;
};

export function EmptyState({
  pose,
  message,
  actionLabel,
  actionTo,
  actionVariant = "primary",
  onAction,
}: EmptyStateProps) {
  const variant = actionVariant === "secondary" ? "secondary" : "default";

  return (
    <div className="empty-state">
      <Mascot pose={pose} size={96} aria-hidden />
      <p className="empty-state-message">{message}</p>
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
