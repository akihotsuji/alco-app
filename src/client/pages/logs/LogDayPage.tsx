import { Camera } from "lucide-react";
import { Link, useParams } from "react-router";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { isFutureTokyoDate, isValidLogDateParam, tokyoToday } from "@/client/lib/app-routes.ts";

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
          <button type="button" className="btn-primary home-log-btn" disabled>
            記録する
          </button>
        ) : (
          <Link className="btn-primary home-log-btn" to={newHref}>
            記録する
          </Link>
        )}
        {future ? (
          <span className="icon-btn home-camera is-disabled" aria-disabled>
            <Camera size={22} />
          </span>
        ) : (
          <Link className="icon-btn home-camera" to={cameraHref} aria-label="カメラで記録">
            <Camera size={22} />
          </Link>
        )}
      </div>
      <p className="log-day-empty">この日の記録はまだありません</p>
    </div>
  );
}
