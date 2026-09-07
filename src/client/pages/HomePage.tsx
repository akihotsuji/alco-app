import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CardSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { HomeWeekStrip } from "@/client/components/home/HomeWeekStrip.tsx";
import { TodaySummaryCard } from "@/client/components/home/TodaySummaryCard.tsx";
import { LogQuickActions } from "@/client/components/logs/LogQuickActions.tsx";
import { MyDrinkQuickList } from "@/client/components/logs/MyDrinkQuickList.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import { useCaptureLog } from "@/client/hooks/use-capture-log.ts";
import { useDrinkLogSummary } from "@/client/hooks/use-drink-log-summary.ts";
import { useMyDrinks } from "@/client/hooks/use-my-drinks.ts";
import { logFormHrefs } from "@/client/lib/app-routes.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { formatHomeDateLabel, tokyoToday } from "@/shared/tokyo-date.ts";

let homePrimaryEntered = false;

export function HomePage() {
  const today = tokyoToday();
  // H8 は写真なしで log-new。H9 は中央タブと同じ「撮ってから入力へ」
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

  const summaryPending = daySummary.isPending || weekSummary.isPending;
  const summaryError = daySummary.isError || weekSummary.isError;

  return (
    <div className="home-page">
      <header className="home-heading">
        <h1 className="home-heading-title">ホーム</h1>
        <p className="home-date">{formatHomeDateLabel(today)}</p>
      </header>
      <div className="home-record-block">
        {summaryPending ? <CardSkeleton /> : null}
        {summaryError ? (
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
        {daySummary.data ? (
          <TodaySummaryCard
            totalCount={daySummary.data.totalCount}
            totalAlcoholG={daySummary.data.totalAlcoholG}
            cheering={cheering}
          />
        ) : null}
        <LogQuickActions
          newHref={newHref}
          onCamera={captureLog}
          primaryEnter={playPrimaryEnter.current}
          onPrimary={() => haptic("light")}
        />
      </div>
      {summaryPending ? (
        <div className="skeleton-card home-week-skeleton" role="status">
          <span className="visually-hidden">読み込み中</span>
        </div>
      ) : null}
      {weekSummary.data ? (
        <HomeWeekStrip today={today} days={weekSummary.data.days} todayFilling={todayFilling} />
      ) : null}
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
