import { Link } from "react-router";
import { AnimatedNumber } from "@/client/components/feedback/AnimatedNumber.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import {
  homeMascotPose,
  homeTodayFootnote,
  homeTodayStatus,
  homeTodayStatusLabel,
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
  const statusClass =
    status === "logged" ? "home-status-pill home-status-logged" : "home-status-pill";
  const guide = useFirstRunGuide();
  const pose =
    presence === "heavy" ? (cheering ? "cheer" : "default") : homeMascotPose(status, cheering);

  return (
    <Card className="home-today-card shadow-outset-sm">
      <div className="home-today-layout">
        <Link className="home-today-link" to="/logs" {...prefetchPointerProps("/logs")}>
          <div className="home-today-head">
            <span className="home-today-title">今日の記録</span>
            <span className={statusClass}>{homeTodayStatusLabel(status)}</span>
          </div>
          <div className="home-today-body">
            <div className="home-today-metrics">
              <div className="home-today-count">
                <AnimatedNumber className="today-score-num" value={totalCount} />
                <span className="home-today-count-unit">杯</span>
              </div>
              <span className="home-today-divider" aria-hidden />
              <div className="home-today-alcohol">
                <span className="home-today-alcohol-label">純アルコール</span>
                <span className="home-today-alcohol-value">
                  <AnimatedNumber value={grams} decimals={1} />
                  <span className="home-today-alcohol-unit"> g</span>
                </span>
              </div>
            </div>
            <p className="home-today-note">{homeTodayFootnote(status, totalCount)}</p>
          </div>
        </Link>
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
    </Card>
  );
}
