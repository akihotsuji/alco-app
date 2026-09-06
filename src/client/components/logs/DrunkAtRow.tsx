import { ChevronRight } from "lucide-react";
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
 * N7: 行「日時 今日 13:05 ›」。タップでネイティブ `datetime-local` が開く（行全体に透明な入力を重ねる）。
 * 値は常に Asia/Tokyo として解釈し UTC ISO で保持する（端末 TZ 非依存。drink-log.md 3.7）。
 */
export function DrunkAtRow({ value, now, error, onChange }: DrunkAtRowProps) {
  const local = instantToTokyoLocal(new Date(value));
  const max = instantToTokyoLocal(new Date(now.getTime() + DRUNK_AT_FUTURE_TOLERANCE_MS));

  return (
    <section className="log-form-section">
      <div className="form-row">
        <span className="form-row-label">日時</span>
        <span className="form-row-value">{formatDrunkAtLabel(value, now)}</span>
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
        <input
          type="datetime-local"
          className="form-row-native"
          aria-label="日時"
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
