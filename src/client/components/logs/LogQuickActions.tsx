import { Camera } from "lucide-react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { cn } from "@/client/lib/utils.ts";

type LogQuickActionsProps = {
  newHref: string;
  /** カメラ円ボタンの挙動。`onCamera` があれば「撮ってから入力へ」（02-home H9）、無ければ `cameraHref` へ遷移 */
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
          記録する
        </Button>
      ) : (
        <Link
          className={cn(buttonVariants(), "home-log-btn", primaryEnter && "home-log-btn-enter")}
          to={newHref}
          onClick={onPrimary}
        >
          記録する
        </Link>
      )}
      <CameraButton onCamera={onCamera} cameraHref={cameraHref} disabled={disabled} />
    </div>
  );
}

function CameraButton({
  onCamera,
  cameraHref,
  disabled,
}: Pick<LogQuickActionsProps, "onCamera" | "cameraHref" | "disabled">) {
  const label = "写真を撮って記録";
  if (disabled) {
    return (
      <IconButton label={label} size="icon-lg" disabled>
        <Camera size={22} />
      </IconButton>
    );
  }
  if (onCamera) {
    return (
      <IconButton label={label} size="icon-lg" onClick={onCamera}>
        <Camera size={22} />
      </IconButton>
    );
  }
  if (cameraHref) {
    return (
      <IconButton label={label} size="icon-lg" asChild>
        <Link to={cameraHref}>
          <Camera size={22} />
        </Link>
      </IconButton>
    );
  }
  return null;
}
