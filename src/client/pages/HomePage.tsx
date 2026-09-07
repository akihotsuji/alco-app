import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { CardSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { LogQuickActions } from "@/client/components/logs/LogQuickActions.tsx";
import { MyDrinkQuickList } from "@/client/components/logs/MyDrinkQuickList.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import { useCaptureLog } from "@/client/hooks/use-capture-log.ts";
import { useDrinkLogSummary } from "@/client/hooks/use-drink-log-summary.ts";
import { useMyDrinks } from "@/client/hooks/use-my-drinks.ts";
import { logFormHrefs, summaryWeekHref } from "@/client/lib/app-routes.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { displayAlcoholGrams } from "@/shared/alcohol.ts";
import { formatHomeDateLabel, tokyoToday, WEEKDAY_LABELS_MON_SUN } from "@/shared/tokyo-date.ts";

let homePrimaryEntered = false;

export function HomePage() {
  const today = tokyoToday();
  // H8「記録する」は写真なしで log-new。H9 カメラは中央タブと同じ「撮ってから入力へ」
  const { newHref } = logFormHrefs();
  const captureLog = useCaptureLog();
  const daySummary = useDrinkLogSummary("day", today);
  const weekSummary = useDrinkLogSummary("week", today);
  const myDrinks = useMyDrinks();
  const [cheering, setCheering] = useState(false);
  const [todayFilling, setTodayFilling] = useState(false);
  const previousTodayCount = useRef<number | null>(null);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playPrimaryEnter = useRef(!homePrimaryEntered);
  homePrimaryEntered = true;

  const todayCount = daySummary.data?.totalCount ?? 0;
  useEffect(() => {
    if (previousTodayCount.current === 0 && todayCount > 0) {
      setTodayFilling(true);
      if (fillTimer.current !== null) {
        clearTimeout(fillTimer.current);
      }
      fillTimer.current = setTimeout(() => setTodayFilling(false), MOTION_MS.fill);
    }
    previousTodayCount.current = todayCount;
  }, [todayCount]);

  useEffect(
    () => () => {
      if (cheerTimer.current !== null) {
        clearTimeout(cheerTimer.current);
      }
      if (fillTimer.current !== null) {
        clearTimeout(fillTimer.current);
      }
    },
    [],
  );

  function cheer() {
    setCheering(true);
    if (cheerTimer.current !== null) {
      clearTimeout(cheerTimer.current);
    }
    cheerTimer.current = setTimeout(() => setCheering(false), MOTION_MS.open);
  }

  return (
    <div className="home-page">
      <p className="home-date">{formatHomeDateLabel(today)}</p>
      {daySummary.isPending || weekSummary.isPending ? <CardSkeleton /> : null}
      {daySummary.isError || weekSummary.isError ? (
        <Card>
          <QueryError
            onRetry={() => {
              void daySummary.refetch();
              void weekSummary.refetch();
            }}
            retrying={daySummary.isFetching || weekSummary.isFetching}
          />
        </Card>
      ) : null}
      {daySummary.data && weekSummary.data ? (
        <Card className="overflow-visible">
          <div className="today-card">
            <div className="today-card-head">
              <span>今日</span>
              <Link className="today-week-link" to={summaryWeekHref(today)}>
                今週
                <ChevronRight size={16} aria-hidden />
              </Link>
            </div>
            <Link className="today-card-main" to="/logs" aria-label="今日の記録を見る">
              <div className="today-scores">
                <div className="today-score">
                  <span className="today-score-row">
                    <AnimatedNumber
                      className="today-score-num"
                      value={daySummary.data.totalCount}
                    />
                    {daySummary.data.totalCount === 0 ? (
                      <span className="rest-pill">休肝</span>
                    ) : null}
                  </span>
                  <span className="today-score-unit">杯</span>
                </div>
                <div className="today-score today-score-end">
                  <AnimatedNumber
                    className="today-score-num"
                    value={displayAlcoholGrams(daySummary.data.totalAlcoholG)}
                    decimals={1}
                  />
                  <span className="today-score-unit">g 純アルコール</span>
                </div>
              </div>
            </Link>
            <nav className="week-dots" aria-label="今週の記録">
              {weekSummary.data.days.map((item, index) => {
                const filled = item.count > 0;
                const weekday = WEEKDAY_LABELS_MON_SUN[index] ?? "";
                const className = [
                  "week-dot",
                  item.date === today && "week-dot-today",
                  filled && "week-dot-filled",
                  item.date === today && todayFilling && "week-dot-filling",
                ]
                  .filter(Boolean)
                  .join(" ");
                const label = `${weekday}曜日 ${
                  item.isFuture ? "未来" : filled ? `${item.count}杯` : "記録なし"
                }`;
                return (
                  <span
                    key={item.date}
                    className={item.isFuture ? "week-day week-day-future" : "week-day"}
                  >
                    <span className="week-day-label" aria-hidden>
                      {weekday}
                    </span>
                    {item.isFuture ? (
                      <button type="button" className={className} aria-label={label} disabled />
                    ) : (
                      <Link className={className} to={`/logs/${item.date}`} aria-label={label} />
                    )}
                  </span>
                );
              })}
            </nav>
            <span className="today-mascot" data-cheer={cheering ? "1" : undefined}>
              <Mascot
                pose={cheering ? "cheer" : daySummary.data.totalCount > 0 ? "default" : "rest"}
                size={72}
                aria-hidden
              />
            </span>
          </div>
        </Card>
      ) : null}
      <LogQuickActions
        newHref={newHref}
        onCamera={captureLog}
        primaryEnter={playPrimaryEnter.current}
        onPrimary={() => haptic("light")}
      />
      <div className="home-mydrinks">
        <div className="home-mydrinks-head">
          <h2 className="section-title">マイドリンク</h2>
          <Link className="header-text-link" to="/logs/my-drinks">
            管理
          </Link>
        </div>
        {myDrinks.isPending ? (
          <div className="mydrink-chip-skeletons" role="status">
            <span className="visually-hidden">マイドリンクを読み込み中</span>
            <span />
            <span />
          </div>
        ) : null}
        {myDrinks.isError ? (
          <QueryError onRetry={() => myDrinks.refetch()} retrying={myDrinks.isFetching} />
        ) : null}
        {myDrinks.data?.items.length ? (
          <MyDrinkQuickList items={myDrinks.data.items} onLogged={cheer} />
        ) : null}
        {myDrinks.data && myDrinks.data.items.length === 0 ? (
          <>
            <p className="home-mydrinks-empty">
              よく飲む一杯を登録すると、ここを 1 回タップで記録できます
            </p>
            <Link className={buttonVariants({ variant: "secondary" })} to="/logs/my-drinks/new">
              登録
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
