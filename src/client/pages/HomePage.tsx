import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CardSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { HomeWeekStrip } from "@/client/components/home/HomeWeekStrip.tsx";
import { TodaySummaryCard } from "@/client/components/home/TodaySummaryCard.tsx";
import { MyDrinkQuickList } from "@/client/components/logs/MyDrinkQuickList.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import { useBottles } from "@/client/hooks/use-bottles.ts";
import { useDrinkLogSummary } from "@/client/hooks/use-drink-log-summary.ts";
import { useMyDrinks } from "@/client/hooks/use-my-drinks.ts";
import { getTastingNotes } from "@/client/hooks/use-tasting-notes.ts";
import { parseMascotPreview, resolveMascotPresence } from "@/client/lib/mascot-presence.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { formatHomeDateLabel, tokyoToday } from "@/shared/tokyo-date.ts";

export function HomePage() {
  const today = tokyoToday();
  const [searchParams] = useSearchParams();
  const guide = useFirstRunGuide();
  const daySummary = useDrinkLogSummary("day", today);
  const weekSummary = useDrinkLogSummary("week", today);
  const myDrinks = useMyDrinks();
  const homeReady = !daySummary.isPending && !weekSummary.isPending && !myDrinks.isPending;
  const logsEmpty =
    (daySummary.data?.totalCount ?? 0) === 0 &&
    (weekSummary.data?.totalCount ?? 0) === 0 &&
    (myDrinks.data?.items.length ?? 0) === 0;
  const extraEnabled = guide.status === "unset" && homeReady && logsEmpty;
  const bottles = useBottles({ view: "all", limit: 1 }, extraEnabled);
  const notes = useQuery({
    queryKey: queryKeys.tastingNotesList({ limit: 1 }),
    queryFn: () => getTastingNotes({ limit: 1 }),
    enabled: extraEnabled,
  });
  const [cheering, setCheering] = useState(false);
  const [todayFilling, setTodayFilling] = useState(false);
  const previousTodayCount = useRef<number | null>(null);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayCount = daySummary.data?.totalCount ?? 0;
  const presence = resolveMascotPresence({
    todayCount: daySummary.data ? daySummary.data.totalCount : null,
    preview: parseMascotPreview(searchParams.get("mascotPreview")),
  }).presence;

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

  useEffect(() => {
    if (guide.status !== "unset" || !homeReady) {
      return;
    }
    if (!logsEmpty) {
      guide.applyActivity(true);
      return;
    }
    if (bottles.isPending || notes.isPending || bottles.isError || notes.isError) {
      return;
    }
    guide.applyActivity((bottles.data?.totalCount ?? 0) > 0 || (notes.data?.totalCount ?? 0) > 0);
  }, [
    bottles.data?.totalCount,
    bottles.isError,
    bottles.isPending,
    guide,
    homeReady,
    logsEmpty,
    notes.data?.totalCount,
    notes.isError,
    notes.isPending,
  ]);

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
            presence={presence}
          />
        ) : null}
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
