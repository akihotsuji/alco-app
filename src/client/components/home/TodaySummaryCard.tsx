import { Link } from "react-router";
import { AnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import {
  homeMascotPose,
  homeTodayActionLabel,
  homeTodayFootnote,
  homeTodayHref,
  homeTodayStatus,
} from "@/client/lib/home-today.ts";
import type { MascotPresence } from "@/client/lib/mascot-presence.ts";
import { prefetchPointerProps } from "@/client/lib/route-chunks.ts";
import { displayAlcoholGrams } from "@/shared/alcohol.ts";

type TodaySummaryCardProps = {
  totalCount: number;
  totalAlcoholG: number;
  cheering: boolean;
  presence?: MascotPresence;
};

export function TodaySummaryCard({
  totalCount,
  totalAlcoholG,
  cheering,
  presence = "upright",
}: TodaySummaryCardProps) {
  const status = homeTodayStatus(totalCount);
  const grams = displayAlcoholGrams(totalAlcoholG);
  const href = homeTodayHref(status);
  const actionLabel = homeTodayActionLabel(status);
  const footnote = homeTodayFootnote(status);
  const guide = useFirstRunGuide();
  const pose =
    presence === "heavy" ? (cheering ? "cheer" : "default") : homeMascotPose(status, cheering);

  return (
    <Card className="home-today-card shadow-outset-sm">
      <Link className="home-today-link" to={href} {...prefetchPointerProps(href)}>
        <div className="home-today-layout">
          <div className="home-today-copy">
            <div className="home-today-head">
              <span className="home-today-title">今日の記録</span>
            </div>
            {status === "logged" ? (
              <div className="home-today-body">
                <div className="home-today-metrics">
                  <div className="home-today-count">
                    <AnimatedNumber className="today-score-num" value={totalCount} />
                    <span className="home-today-count-unit">杯</span>
                  </div>
                  <span className="home-today-divider" aria-hidden />
                  <div className="home-today-alcohol">
                    <span className="home-today-alcohol-label">純アルコール量</span>
                    <span className="home-today-alcohol-value">
                      <AnimatedNumber value={grams} decimals={1} />
                      <span className="home-today-alcohol-unit"> g</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="home-today-note">{footnote}</p>
            )}
            <span className="home-today-action">{actionLabel}</span>
          </div>
          <span className="today-mascot" data-cheer={cheering ? "1" : undefined}>
            <Mascot
              pose={pose}
              size={72}
              life={!guide.hideHomeMascotLife}
              lifeId="home-today"
              presence={presence}
              reactToken={cheering ? 1 : 0}
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </Card>
  );
}
