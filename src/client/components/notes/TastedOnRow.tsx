import { ChevronRight } from "lucide-react";
import { formatMonthDay, isTokyoToday, tokyoToday } from "@/shared/tokyo-date.ts";

type TastedOnRowProps = {
  value: string;
  now: Date;
  error?: string;
  onChange: (date: string) => void;
};

export function TastedOnRow({ value, now, error, onChange }: TastedOnRowProps) {
  const today = tokyoToday(now);
  const label = isTokyoToday(value, now) ? "今日" : formatMonthDay(value);

  return (
    <section className="log-form-section">
      <div className="form-row">
        <span className="form-row-label">飲んだ日</span>
        <span className="form-row-value">{label}</span>
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
        <input
          type="date"
          className="form-row-native"
          aria-label="飲んだ日"
          aria-invalid={error ? true : undefined}
          value={value}
          max={today}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
