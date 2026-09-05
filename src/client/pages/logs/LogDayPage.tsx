import { Camera } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button, buttonVariants } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { isFutureTokyoDate, isValidLogDateParam, tokyoToday } from "@/client/lib/app-routes.ts";
import { cn } from "@/client/lib/utils.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";

export function LogDayPage() {
  const { date } = useParams();
  if (date && !isValidLogDateParam(date)) {
    return <NotFoundPage />;
  }
  const day = date ?? tokyoToday();
  const future = isFutureTokyoDate(day);
  const newHref = date ? `/logs/new?date=${date}` : "/logs/new";
  const cameraHref = date ? `/logs/new?date=${date}&camera=1` : "/logs/new?camera=1";

  return (
    <div className="log-day">
      <p className="log-day-total">
        <span className="rest-pill">休肝</span>
      </p>
      <div className="home-actions">
        {future ? (
          <Button className="home-log-btn" type="button" disabled>
            記録する
          </Button>
        ) : (
          <Link className={cn(buttonVariants(), "home-log-btn")} to={newHref}>
            記録する
          </Link>
        )}
        {future ? (
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
      <p className="log-day-empty">この日の記録はまだありません</p>
    </div>
  );
}
