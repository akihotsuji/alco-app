import { Calendar, ChevronRight } from "lucide-react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
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
      <FieldLabel optional>飲んだ日</FieldLabel>
      <div className="form-row">
        <Calendar size={18} className="form-row-icon" aria-hidden />
        <span className="form-row-value form-row-value-start">{label}</span>
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
        <input
          type="date"
          className="form-row-native"
          id="note-tasted-on"
          aria-label="飲んだ日"
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy("note-tasted-on", error)}
          value={value}
          max={today}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <FieldError id="note-tasted-on" error={error} />
    </section>
  );
}
