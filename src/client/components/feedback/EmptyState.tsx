import { Link } from "react-router";
import { Mascot, type MascotPose } from "@/client/components/mascot/Mascot.tsx";

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
  const buttonClass = actionVariant === "secondary" ? "btn-secondary" : "btn-primary";

  return (
    <div className="empty-state">
      <Mascot pose={pose} size={96} aria-hidden />
      <p className="empty-state-message">{message}</p>
      {actionLabel && actionTo ? (
        <Link className={buttonClass} to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction && !actionTo ? (
        <button type="button" className={buttonClass} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
