import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/client/components/ui/card.tsx";
import { summaryWeekHref } from "@/client/lib/app-routes.ts";
import { homeWeekDayView } from "@/client/lib/home-today.ts";
import { prefetchPointerProps } from "@/client/lib/route-chunks.ts";
import type { DrinkLogSummaryDay } from "@/shared/drink-logs.ts";

type HomeWeekStripProps = {
  today: string;
  days: DrinkLogSummaryDay[];
  todayFilling: boolean;
};

export function HomeWeekStrip({ today, days, todayFilling }: HomeWeekStripProps) {
  return (
    <Card className="home-week-card shadow-outset-sm">
      <div className="home-week">
        <div className="home-week-head">
          <h2 className="home-week-title">今週</h2>
          <Link
            className="home-week-link"
            to={summaryWeekHref(today)}
            {...prefetchPointerProps(summaryWeekHref(today))}
          >
            詳しく見る
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <nav className="home-week-days" aria-label="今週の記録">
          {days.map((item, index) => {
            const view = homeWeekDayView(item, index, today, todayFilling);
            const markClass = [
              "home-week-mark",
              view.filling
                ? "home-week-mark-filling"
                : view.hasRecord
                  ? "home-week-mark-filled"
                  : "home-week-mark-empty",
            ].join(" ");
            const numClass = ["home-week-num", view.isToday && "home-week-num-today"]
              .filter(Boolean)
              .join(" ");
            const dayClass = ["home-week-day", view.isFuture && "home-week-day-future"]
              .filter(Boolean)
              .join(" ");
            const inner = (
              <>
                <span className="home-week-dow" aria-hidden>
                  {view.weekday}
                </span>
                <span className={numClass} aria-hidden>
                  {view.dayNumber}
                </span>
                <span className={markClass} aria-hidden />
              </>
            );
            if (view.isFuture) {
              return (
                <button
                  key={view.date}
                  type="button"
                  className={dayClass}
                  aria-label={view.label}
                  disabled
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={view.date}
                className={dayClass}
                to={view.href}
                aria-label={view.label}
                {...prefetchPointerProps(view.href)}
              >
                {inner}
              </Link>
            );
          })}
        </nav>
        <div className="home-week-legend">
          <span className="home-week-legend-item">
            <span className="home-week-legend-dot" aria-hidden />
            記録あり
          </span>
          <span className="home-week-legend-item">
            <span className="home-week-legend-today" aria-hidden />
            今日
          </span>
        </div>
      </div>
    </Card>
  );
}
