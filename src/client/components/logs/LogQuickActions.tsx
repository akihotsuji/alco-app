import { Camera } from "lucide-react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { cn } from "@/client/lib/utils.ts";

type LogQuickActionsProps = {
  newHref: string;
  cameraHref: string;
  disabled?: boolean;
};

export function LogQuickActions({ newHref, cameraHref, disabled = false }: LogQuickActionsProps) {
  return (
    <div className="home-actions">
      {disabled ? (
        <Button className="home-log-btn" type="button" disabled>
          記録する
        </Button>
      ) : (
        <Link className={cn(buttonVariants(), "home-log-btn")} to={newHref}>
          記録する
        </Link>
      )}
      {disabled ? (
        <IconButton label="カメラで記録" size="icon-lg" disabled>
          <Camera size={22} />
        </IconButton>
      ) : (
        <IconButton label="カメラで記録" size="icon-lg" asChild>
          <Link to={cameraHref}>
            <Camera size={22} />
          </Link>
        </IconButton>
      )}
    </div>
  );
}
