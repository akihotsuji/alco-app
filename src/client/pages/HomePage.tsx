import { Camera } from "lucide-react";
import { Link } from "react-router";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { Card } from "@/client/components/ui/card.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { cn } from "@/client/lib/utils.ts";
import {
  formatHomeDateLabel,
  isoWeekDates,
  tokyoToday,
  WEEKDAY_LABELS_MON_SUN,
} from "@/shared/tokyo-date.ts";

export function HomePage() {
  const today = tokyoToday();
  const week = isoWeekDates(today);

  return (
    <div className="home-page">
      <p className="home-date">{formatHomeDateLabel(today)}</p>
      <Card className="overflow-visible">
        <Link className="today-card" to="/summary/week">
          <div className="today-scores">
            <div className="today-score">
              <span className="today-score-num">0</span>
              <span className="today-score-unit">杯</span>
            </div>
            <span className="rest-pill">休肝</span>
            <div className="today-score">
              <span className="today-score-num">0</span>
              <span className="today-score-unit">g 純アルコール</span>
            </div>
          </div>
          <div className="week-dots" aria-hidden>
            {week.map((date, index) => (
              <span key={date} className={date === today ? "week-dot week-dot-today" : "week-dot"}>
                <span className="week-dot-label">{WEEKDAY_LABELS_MON_SUN[index] ?? ""}</span>
              </span>
            ))}
          </div>
          <span className="today-mascot">
            <Mascot pose="rest" size={72} aria-hidden />
          </span>
        </Link>
      </Card>
      <div className="home-actions">
        <Link className={cn(buttonVariants(), "home-log-btn")} to="/logs/new">
          記録する
        </Link>
        <IconButton label="カメラで記録" size="icon-lg" asChild>
          <Link to="/logs/new?camera=1">
            <Camera size={22} />
          </Link>
        </IconButton>
      </div>
      <div className="home-mydrinks">
        <div className="home-mydrinks-head">
          <h2 className="section-title">マイドリンク</h2>
          <Link className="header-text-link" to="/logs/my-drinks">
            管理
          </Link>
        </div>
        <p className="home-mydrinks-empty">
          よく飲む一杯を登録すると、ここを 1 回タップで記録できます
        </p>
        <Link className={buttonVariants({ variant: "secondary" })} to="/logs/my-drinks/new">
          登録
        </Link>
      </div>
    </div>
  );
}
