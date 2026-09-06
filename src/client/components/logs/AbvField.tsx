import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { ABV_STEP, formatAbv, stepAbv } from "@/client/lib/log-form.ts";
import { MOTION_MS } from "@/client/lib/motion.ts";
import { ABV_PERCENT_MAX, ABV_PERCENT_MIN } from "@/shared/alcohol.ts";

type AbvFieldProps = {
  value: number | null;
  error?: string;
  onChange: (value: number | null) => void;
};

/** 長押し: この時間を超えたら連続。間隔は --dur-stagger（80ms）と同じ */
const HOLD_DELAY_MS = MOTION_MS.fill;
const HOLD_INTERVAL_MS = MOTION_MS.stagger;

function parseAbv(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** N5: スコア 40px + ステッパー（0.1 刻み、長押しで連続）。スコアのタップで手入力 */
export function AbvField({ value, error, onChange }: AbvFieldProps) {
  const [manualOpen, setManualOpen] = useState(value === null);
  const [focusRequested, setFocusRequested] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (value === null) {
      setManualOpen(true);
    }
  }, [value]);

  useEffect(() => {
    if (manualOpen && focusRequested) {
      inputRef.current?.focus();
      setFocusRequested(false);
    }
  }, [manualOpen, focusRequested]);

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
    setManualOpen(false);
    step(direction);
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => step(direction), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }

  return (
    <fieldset className="log-form-section">
      <legend className="field-label">度数</legend>
      <div className="score-row">
        {manualOpen ? (
          <>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              className="score-input"
              aria-label="度数（%）"
              aria-invalid={error ? true : undefined}
              min={ABV_PERCENT_MIN}
              max={ABV_PERCENT_MAX}
              step={ABV_STEP}
              value={value ?? ""}
              onChange={(event) => onChange(parseAbv(event.target.value))}
            />
            <span className="score-unit">%</span>
          </>
        ) : (
          <button
            type="button"
            className="score-button"
            onClick={() => {
              setManualOpen(true);
              setFocusRequested(true);
            }}
          >
            <span className="score-value">{formatAbv(value)}</span>
            <span className="score-unit">%</span>
          </button>
        )}
        <div className="stepper">
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
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
