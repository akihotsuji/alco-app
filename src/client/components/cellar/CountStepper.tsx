import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { BOTTLE_COUNT_MAX, BOTTLE_COUNT_MIN } from "@/shared/bottles.ts";

type CountStepperProps = {
  value: number;
  onChange: (value: number) => void;
  error?: string;
};

export function clampCountInput(raw: string, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(BOTTLE_COUNT_MAX, Math.max(BOTTLE_COUNT_MIN, parsed));
}

export function CountStepper({ value, onChange, error }: CountStepperProps) {
  return (
    <fieldset className="log-form-section">
      <legend className="field-label">本数</legend>
      <div className="count-stepper">
        <IconButton
          label="本数を減らす"
          disabled={value <= BOTTLE_COUNT_MIN}
          onClick={() => onChange(Math.max(BOTTLE_COUNT_MIN, value - 1))}
        >
          <Minus size={20} />
        </IconButton>
        <input
          id="bottle-count"
          className="count-stepper-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="本数"
          aria-invalid={error ? true : undefined}
          value={String(value)}
          onChange={(event) => onChange(clampCountInput(event.target.value, value))}
          onBlur={(event) => onChange(clampCountInput(event.target.value, BOTTLE_COUNT_MIN))}
        />
        <span className="count-stepper-unit">本</span>
        <IconButton
          label="本数を増やす"
          disabled={value >= BOTTLE_COUNT_MAX}
          onClick={() => onChange(Math.min(BOTTLE_COUNT_MAX, value + 1))}
        >
          <Plus size={20} />
        </IconButton>
      </div>
      <p className="field-hint">
        {BOTTLE_COUNT_MIN}〜{BOTTLE_COUNT_MAX} 本
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
