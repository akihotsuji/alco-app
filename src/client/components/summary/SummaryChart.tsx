import { useEffect, useRef, useState } from "react";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { displayAlcoholGrams } from "@/shared/alcohol.ts";
import type { DrinkLogSummaryDay } from "@/shared/drink-logs.ts";
import type { SummaryViewPeriod } from "@/shared/summary.ts";
import { WEEKDAY_LABELS_MON_SUN } from "@/shared/tokyo-date.ts";

const chartPlayed: Record<SummaryViewPeriod, boolean> = {
  week: false,
  month: false,
};

type SummaryChartProps = {
  period: SummaryViewPeriod;
  days: readonly DrinkLogSummaryDay[];
  today: string;
};

export function SummaryChart({ period, days, today }: SummaryChartProps) {
  const playEnter = useRef(!chartPlayed[period]);
  chartPlayed[period] = true;
  const firstDays = useRef(days);
  const [enter, setEnter] = useState(playEnter.current);

  useEffect(() => {
    if (firstDays.current !== days) {
      setEnter(false);
    }
  }, [days]);

  useEffect(() => {
    if (!enter) {
      return;
    }
    const timer = window.setTimeout(() => setEnter(false), MOTION_MS.enter);
    return () => window.clearTimeout(timer);
  }, [enter]);

  const max = Math.max(0, ...days.map((item) => displayAlcoholGrams(item.alcoholG)));
  const count = Math.max(days.length, 1);
  const gapRatio = period === "week" ? 0.38 : 0.22;
  const unit = 100 / count;
  const barWidth = unit * (1 - gapRatio);
  const inset = (unit - barWidth) / 2;

  return (
    <div className="summary-chart-wrap">
      <svg
        className="summary-chart"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        data-period={period}
        data-enter={enter ? "1" : undefined}
      >
        {days.map((item, index) => {
          const value = displayAlcoholGrams(item.alcoholG);
          const height = max > 0 ? (value / max) * 100 : 0;
          if (height <= 0) {
            return null;
          }
          const className = [item.date === today && "is-today", item.isFuture && "is-future"]
            .filter(Boolean)
            .join(" ");
          return (
            <rect
              key={item.date}
              className={className || undefined}
              x={index * unit + inset}
              y={100 - height}
              width={barWidth}
              height={height}
              rx={period === "week" ? 1.2 : 0.4}
            />
          );
        })}
      </svg>
      {period === "week" ? (
        <div className="summary-chart-labels" aria-hidden>
          {WEEKDAY_LABELS_MON_SUN.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
