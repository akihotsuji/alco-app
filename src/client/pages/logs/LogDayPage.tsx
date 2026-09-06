import { Wine } from "lucide-react";
import { type Ref, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { AnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useDeleteDrinkLog, useDrinkLogsDay } from "@/client/hooks/use-drink-logs.ts";
import { useHighlightRow } from "@/client/hooks/use-highlight-row.ts";
import { agentDebugLog } from "@/client/lib/agent-debug.ts";
import { isValidLogDateParam, tokyoToday } from "@/client/lib/app-routes.ts";
import { undoDrinkLogId } from "@/client/lib/history-state.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { displayAlcoholGrams } from "@/shared/alcohol.ts";
import { DRINK_TYPE_LABELS } from "@/shared/constants.ts";
import type { DrinkLogItem } from "@/shared/drink-logs.ts";
import { formatTokyoTime } from "@/shared/tokyo-date.ts";

export function LogDayPage() {
  const { date } = useParams();
  if (date && !isValidLogDateParam(date)) {
    return <NotFoundPage />;
  }
  return <ValidLogDayPage day={date ?? tokyoToday()} />;
}

function ValidLogDayPage({ day }: { day: string }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const query = useDrinkLogsDay(day);
  const remove = useDeleteDrinkLog();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const shownUndo = useRef<string | null>(null);
  const highlightId = searchParams.get("highlight");
  const itemIds = query.data?.items.map((item) => item.id) ?? [];
  const highlight = useHighlightRow(highlightId, itemIds);
  const undoId = undoDrinkLogId(location.state);

  useEffect(() => {
    // #region agent log
    agentDebugLog({
      hypothesisId: "H1",
      location: "LogDayPage.tsx:undo-effect",
      message: "Undo toast eligibility evaluated",
      data: {
        undoId,
        queryHasData: Boolean(query.data),
        rowContainsUndo: query.data?.items.some((item) => item.id === undoId) ?? false,
        shownUndoId: shownUndo.current,
      },
    });
    // #endregion
    if (!undoId || !query.data?.items.some((item) => item.id === undoId)) {
      return;
    }
    if (shownUndo.current === undoId) {
      return;
    }
    shownUndo.current = undoId;
    const current = window.history.state;
    if (typeof current === "object" && current !== null) {
      window.history.replaceState({ ...current, usr: null }, "");
    }
    showToast({
      message: TOAST_MESSAGES.logged,
      action: {
        label: "取り消す",
        onSelect: () => {
          // #region agent log
          agentDebugLog({
            hypothesisId: "H3",
            location: "LogDayPage.tsx:undo-onSelect",
            message: "Undo callback entered and removal scheduled",
            data: { undoId, delayMs: MOTION_MS.state },
          });
          // #endregion
          setRemovingId(undoId);
          setTimeout(() => {
            // #region agent log
            agentDebugLog({
              hypothesisId: "H3",
              location: "LogDayPage.tsx:undo-timer",
              message: "Undo removal timer fired",
              data: { undoId, mutationPending: remove.isPending },
            });
            // #endregion
            remove.mutate(undoId, {
              onSuccess: () => {
                // #region agent log
                agentDebugLog({
                  hypothesisId: "H4",
                  location: "LogDayPage.tsx:undo-mutation-success",
                  message: "Undo DELETE mutation succeeded",
                  data: { undoId },
                });
                // #endregion
              },
              onError: () => {
                // #region agent log
                agentDebugLog({
                  hypothesisId: "H4",
                  location: "LogDayPage.tsx:undo-mutation-error",
                  message: "Undo DELETE mutation failed",
                  data: { undoId },
                });
                // #endregion
                setRemovingId(null);
                showToast({ message: TOAST_MESSAGES.saveFailed });
              },
            });
          }, MOTION_MS.state);
        },
      },
    });
  }, [query.data, remove, showToast, undoId]);

  useEffect(() => {
    if (!removingId) {
      return;
    }
    const row = document.querySelector(`[data-log-id="${CSS.escape(removingId)}"] .log-row`);
    // #region agent log
    agentDebugLog({
      hypothesisId: "H5",
      location: "LogDayPage.tsx:removing-state-commit",
      message: "Removing state committed to rendered row",
      data: {
        removingId,
        rowFound: row instanceof HTMLElement,
        hasRemovingClass: row?.classList.contains("is-removing") ?? false,
      },
    });
    // #endregion
  }, [removingId]);

  return (
    <div className="log-day">
      {query.isPending ? (
        <>
          <div className="log-day-total-skeleton" aria-hidden />
          <ListSkeleton count={3} />
        </>
      ) : null}
      {query.isError ? (
        <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : null}
      {query.data ? (
        <div className="skeleton-fade log-day-results">
          <p className="log-day-total" aria-live="polite">
            {query.data.totalCount === 0 ? (
              <span className="rest-pill">休肝</span>
            ) : (
              <>
                <AnimatedNumber value={query.data.totalCount} /> 杯 ・{" "}
                <AnimatedNumber
                  value={displayAlcoholGrams(query.data.totalAlcoholG)}
                  decimals={1}
                />{" "}
                g
              </>
            )}
          </p>
          {query.data.items.length === 0 ? (
            <p className="log-day-empty">
              {query.data.hasAnyLogs
                ? "この日の記録はまだありません"
                : "中央の記録ボタンから写真を撮って記録できます"}
            </p>
          ) : (
            <div className="log-list">
              {query.data.items.map((item) => {
                const isTarget = item.id === highlight.targetId;
                return (
                  <div
                    key={item.id}
                    className="log-row-wrap"
                    data-log-id={item.id}
                    data-enter={isTarget && highlight.phase === "enter" ? "1" : undefined}
                  >
                    <LogDayRow
                      item={item}
                      ref={isTarget ? highlight.register : undefined}
                      highlighted={
                        isTarget &&
                        (highlight.phase === "highlight" || highlight.phase === "fading")
                      }
                      fading={isTarget && highlight.phase === "fading"}
                      removing={item.id === removingId}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

type LogDayRowProps = {
  item: DrinkLogItem;
  ref?: Ref<HTMLAnchorElement>;
  highlighted: boolean;
  fading: boolean;
  removing: boolean;
};

function LogDayRow({ item, ref, highlighted, fading, removing }: LogDayRowProps) {
  const name = item.drinkName ?? DRINK_TYPE_LABELS[item.drinkType];
  const secondary = [
    formatTokyoTime(new Date(item.drunkAt)),
    `${item.abvPercent}%`,
    item.bottleId ? item.drinkName : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ・ ");
  const classes = [
    "log-row",
    highlighted && "is-highlight",
    fading && "is-fading",
    removing && "is-removing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      ref={ref}
      className={classes}
      to={`/logs/entries/${item.id}/edit`}
      aria-label={`${name} ${item.volumeMl}ml、${displayAlcoholGrams(item.alcoholG).toFixed(1)}g`}
    >
      {item.thumbPhotoId ? (
        <img
          className="log-row-thumb"
          src={`/api/photos/${item.thumbPhotoId}/content`}
          alt=""
          loading="lazy"
        />
      ) : (
        <span className="log-row-icon" aria-hidden>
          <Wine size={24} />
        </span>
      )}
      <span className="log-row-copy">
        <span className="log-row-top">
          <strong>
            {name} {item.volumeMl}ml
          </strong>
          <span>{displayAlcoholGrams(item.alcoholG).toFixed(1)}g</span>
        </span>
        <span className="log-row-sub">{secondary}</span>
      </span>
      <span className="log-row-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}
