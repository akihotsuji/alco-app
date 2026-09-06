import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CardSkeleton, ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { SummaryChart } from "@/client/components/summary/SummaryChart.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { useDrinkLogSummary } from "@/client/hooks/use-drink-log-summary.ts";
import {
  isValidLogDateParam,
  logDayHref,
  summaryMonthHref,
  summaryWeekHref,
  tokyoToday,
} from "@/client/lib/app-routes.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { displayAlcoholGrams } from "@/shared/alcohol.ts";
import type { DrinkLogSummary, DrinkLogSummaryDay } from "@/shared/drink-logs.ts";
import {
  canAdvanceSummary,
  foldMonthWeeks,
  formatWeekPagerLabel,
  type MonthWeekRow,
  type SummaryViewPeriod,
  shiftSummaryDate,
} from "@/shared/summary.ts";
import {
  addCalendarDays,
  formatShortMonthDay,
  formatWeekdayShort,
  formatYearMonth,
  isoWeekMonday,
} from "@/shared/tokyo-date.ts";

export function SummaryWeekPage() {
  return <SummaryPage period="week" />;
}

export function SummaryMonthPage() {
  return <SummaryPage period="month" />;
}

function SummaryPage({ period }: { period: SummaryViewPeriod }) {
  const [params] = useSearchParams();
  const raw = params.get("date");
  if (raw !== null && !isValidLogDateParam(raw)) {
    return <NotFoundPage />;
  }
  return <ValidSummaryPage period={period} date={raw ?? tokyoToday()} />;
}

function ValidSummaryPage({ period, date }: { period: SummaryViewPeriod; date: string }) {
  const navigate = useNavigate();
  const today = tokyoToday();
  const query = useDrinkLogSummary(period, date);
  const canNext = canAdvanceSummary(period, date, today);
  const prevDate = shiftSummaryDate(period, date, -1);
  const nextDate = shiftSummaryDate(period, date, 1);
  const monday = isoWeekMonday(date);

  return (
    <div className="summary-page">
      <nav className="summary-pager" aria-label={period === "week" ? "週送り" : "月送り"}>
        <IconButton
          label={period === "week" ? "前週" : "前月"}
          onClick={() => navigate(periodHref(period, prevDate))}
        >
          <ChevronLeft size={22} />
        </IconButton>
        <p className="summary-pager-label">
          {period === "week"
            ? formatWeekPagerLabel(monday, addCalendarDays(monday, 6))
            : formatYearMonth(date)}
        </p>
        <IconButton
          label={period === "week" ? "次週" : "次月"}
          disabled={!canNext}
          onClick={() => navigate(periodHref(period, nextDate))}
        >
          <ChevronRight size={22} />
        </IconButton>
      </nav>
      {query.isPending ? (
        <>
          <CardSkeleton />
          <ListSkeleton count={4} />
        </>
      ) : null}
      {query.isError ? (
        <Card>
          <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
        </Card>
      ) : null}
      {query.data ? (
        <div className="skeleton-fade summary-results">
          <SummaryTotalsCard period={period} summary={query.data} today={today} />
          {period === "week" ? (
            <WeekDayList days={query.data.days} />
          ) : (
            <MonthWeekList rows={foldMonthWeeks(query.data.days)} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function periodHref(period: SummaryViewPeriod, date: string): string {
  return period === "week" ? summaryWeekHref(date) : summaryMonthHref(date);
}

function SummaryTotalsCard({
  period,
  summary,
  today,
}: {
  period: SummaryViewPeriod;
  summary: DrinkLogSummary;
  today: string;
}) {
  return (
    <Card>
      <div className="summary-card">
        <div className="summary-scores">
          <div className="summary-score">
            <span className="summary-score-num">{summary.totalCount}</span>
            <span className="summary-score-unit">杯</span>
          </div>
          <div className="summary-score">
            <span className="summary-score-num">
              {displayAlcoholGrams(summary.totalAlcoholG).toFixed(1)}
            </span>
            <span className="summary-score-unit">g</span>
          </div>
          <div className="summary-score">
            <span className="summary-score-num">{summary.dryDayCount}</span>
            <span className="summary-score-unit">休肝 日</span>
          </div>
        </div>
        <SummaryChart period={period} days={summary.days} today={today} />
      </div>
    </Card>
  );
}

function WeekDayList({ days }: { days: readonly DrinkLogSummaryDay[] }) {
  return (
    <ul className="summary-rows">
      {days.map((item) => (
        <li key={item.date}>
          <WeekDayRow day={item} />
        </li>
      ))}
    </ul>
  );
}

function WeekDayRow({ day }: { day: DrinkLogSummaryDay }) {
  const heading = `${formatShortMonthDay(day.date)} ${formatWeekdayShort(day.date)}`;
  const detail = day.isFuture
    ? "—"
    : day.isDryDay
      ? "休肝"
      : `${day.count} 杯 ・ ${displayAlcoholGrams(day.alcoholG).toFixed(1)} g`;
  const className = ["summary-row", day.isFuture && "summary-row-future"].filter(Boolean).join(" ");
  const copy = (
    <span>
      {heading} <span className={day.isDryDay ? "summary-row-rest" : undefined}>{detail}</span>
    </span>
  );

  if (day.isFuture) {
    return <div className={className}>{copy}</div>;
  }

  return (
    <Link className={className} to={logDayHref(day.date)}>
      {copy}
      <span className="log-row-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}

function MonthWeekList({ rows }: { rows: readonly MonthWeekRow[] }) {
  return (
    <ul className="summary-rows">
      {rows.map((row) => (
        <li key={row.weekDate}>
          <Link className="summary-row" to={summaryWeekHref(row.weekDate)}>
            <span>
              {formatShortMonthDay(row.from)}〜{formatShortMonthDay(row.to)} {row.totalCount} 杯 ・{" "}
              {displayAlcoholGrams(row.totalAlcoholG).toFixed(1)} g ・ 休肝 {row.dryDayCount}
            </span>
            <span className="log-row-chevron" aria-hidden>
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
