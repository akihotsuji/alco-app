import { Calendar, ChevronRight } from "lucide-react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { formatDrunkAtLabel } from "@/client/lib/log-form.ts";
import { DRUNK_AT_FUTURE_TOLERANCE_MS } from "@/shared/drink-logs.ts";
import { instantToTokyoLocal, tokyoLocalToIso } from "@/shared/tokyo-date.ts";

type DrunkAtRowProps = {
  value: string;
  now: Date;
  error?: string;
  onChange: (iso: string) => void;
};

/**
 * N7: ラベル上 + 行「今日 13:05 ›」。タップでネイティブ `datetime-local`。
 * 値は常に Asia/Tokyo として解釈し UTC ISO で保持する（端末 TZ 非依存。drink-log.md 3.7）。
 */
export function DrunkAtRow({ value, now, error, onChange }: DrunkAtRowProps) {
  const local = instantToTokyoLocal(new Date(value));
  const max = instantToTokyoLocal(new Date(now.getTime() + DRUNK_AT_FUTURE_TOLERANCE_MS));

  return (
    <section className="log-form-section">
      <FieldLabel>飲んだ日時</FieldLabel>
      <div className="form-row">
        <Calendar size={18} className="form-row-icon" aria-hidden />
        <span className="form-row-value form-row-value-start">
          {formatDrunkAtLabel(value, now)}
        </span>
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
        <input
          type="datetime-local"
          className="form-row-native"
          aria-label="飲んだ日時"
          aria-invalid={error ? true : undefined}
          value={local}
          max={max}
          step={60}
          onChange={(event) => {
            const iso = tokyoLocalToIso(event.target.value);
            if (iso) {
              onChange(iso);
            }
          }}
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
