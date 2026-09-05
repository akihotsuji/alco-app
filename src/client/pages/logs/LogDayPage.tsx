import { useParams } from "react-router";
import { LogQuickActions } from "@/client/components/logs/LogQuickActions.tsx";
import {
  isFutureTokyoDate,
  isValidLogDateParam,
  logFormHrefs,
  tokyoToday,
} from "@/client/lib/app-routes.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";

export function LogDayPage() {
  const { date } = useParams();
  if (date && !isValidLogDateParam(date)) {
    return <NotFoundPage />;
  }
  const day = date ?? tokyoToday();
  const future = isFutureTokyoDate(day);
  const { newHref, cameraHref } = logFormHrefs(date);

  return (
    <div className="log-day">
      <p className="log-day-total">
        <span className="rest-pill">休肝</span>
      </p>
      <LogQuickActions newHref={newHref} cameraHref={cameraHref} disabled={future} />
      <p className="log-day-empty">この日の記録はまだありません</p>
    </div>
  );
}
