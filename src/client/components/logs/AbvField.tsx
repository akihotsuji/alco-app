import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { ABV_STEP, formatGrams, liveAlcoholGrams, stepAbv } from "@/client/lib/log-form.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN } from "@/shared/alcohol.ts";

type AbvFieldProps = {
  value: number | null;
  volumeMl?: number | null;
  error?: string;
  onChange: (value: number | null) => void;
};

const HOLD_DELAY_MS = MOTION_MS.fill;
const HOLD_INTERVAL_MS = MOTION_MS.stagger;

function parseAbv(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** N5: − / 数値 / % / ＋ を近接。直接入力可。純アルコール量を補助表示 */
export function AbvField({ value, volumeMl = null, error, onChange }: AbvFieldProps) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const grams = liveAlcoholGrams({ volumeMl, abvPercent: value });

  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdInterval.current !== null) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  function step(direction: 1 | -1) {
    const next = stepAbv(valueRef.current, direction);
    valueRef.current = next;
    onChange(next);
  }

  function startHold(direction: 1 | -1) {
    stopHold();
    step(direction);
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => step(direction), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }

  return (
    <fieldset className="log-form-section">
      <legend>
        <FieldLabel htmlFor="log-abv-percent">アルコール度数</FieldLabel>
      </legend>
      <div className="abv-cluster">
        <IconButton
          label="度数を 0.1 減らす"
          size="icon-lg"
          disabled={value !== null && value <= ABV_PERCENT_MIN}
          onPointerDown={(event) => {
            if (event.button === 0) {
              startHold(-1);
            }
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              step(-1);
            }
          }}
        >
          <Minus size={22} />
        </IconButton>
        <div className="unit-field abv-input">
          <input
            id="log-abv-percent"
            type="number"
            inputMode="decimal"
            className="unit-field-input"
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldDescribedBy("log-abv-percent", error)}
            min={ABV_PERCENT_MIN}
            max={ABV_PERCENT_MAX}
            step={ABV_STEP}
            value={value ?? ""}
            onChange={(event) => onChange(parseAbv(event.target.value))}
          />
          <span className="unit-field-suffix">%</span>
        </div>
        <IconButton
          label="度数を 0.1 増やす"
          size="icon-lg"
          disabled={value !== null && value >= ABV_PERCENT_MAX}
          onPointerDown={(event) => {
            if (event.button === 0) {
              startHold(1);
            }
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              step(1);
            }
          }}
        >
          <Plus size={22} />
        </IconButton>
      </div>
      <p className="live-grams" aria-live="polite">
        純アルコール量 {formatGrams(grams)} g
      </p>
      <FieldError id="log-abv-percent" error={error} />
    </fieldset>
  );
}
