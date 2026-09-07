import { Camera, Plus } from "lucide-react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { cn } from "@/client/lib/utils.ts";

type LogQuickActionsProps = {
  newHref: string;
  /** カメラボタンの挙動。`onCamera` があれば「撮ってから入力へ」（02-home H9）、無ければ `cameraHref` へ遷移 */
  onCamera?: () => void;
  cameraHref?: string;
  disabled?: boolean;
  primaryEnter?: boolean;
  onPrimary?: () => void;
};

export function LogQuickActions({
  newHref,
  onCamera,
  cameraHref,
  disabled = false,
  primaryEnter = false,
  onPrimary,
}: LogQuickActionsProps) {
  return (
    <div className="home-actions">
      {disabled ? (
        <Button className="home-log-btn" type="button" disabled>
          <Plus size={20} aria-hidden />
          お酒を記録する
        </Button>
      ) : (
        <Link
          className={cn(buttonVariants(), "home-log-btn", primaryEnter && "home-log-btn-enter")}
          to={newHref}
          onClick={onPrimary}
        >
          <Plus size={20} aria-hidden />
          お酒を記録する
        </Link>
      )}
      <PhotoButton onCamera={onCamera} cameraHref={cameraHref} disabled={disabled} />
    </div>
  );
}

function PhotoButton({
  onCamera,
  cameraHref,
  disabled,
}: Pick<LogQuickActionsProps, "onCamera" | "cameraHref" | "disabled">) {
  const label = "写真から記録";
  const className = cn(buttonVariants({ variant: "secondary" }), "home-photo-btn");
  if (disabled) {
    return (
      <Button className="home-photo-btn" type="button" variant="secondary" disabled>
        <Camera size={20} aria-hidden />
        {label}
      </Button>
    );
  }
  if (onCamera) {
    return (
      <button type="button" className={className} onClick={onCamera}>
        <Camera size={20} aria-hidden />
        {label}
      </button>
    );
  }
  if (cameraHref) {
    return (
      <Link className={className} to={cameraHref}>
        <Camera size={20} aria-hidden />
        {label}
      </Link>
    );
  }
  return null;
}
