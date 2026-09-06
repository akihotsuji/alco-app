import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { BOTTLE_COUNT_MAX, BOTTLE_COUNT_MIN } from "@/shared/bottles.ts";

type CountStepperProps = {
  value: number;
  onChange: (value: number) => void;
};

export function CountStepper({ value, onChange }: CountStepperProps) {
  return (
    <fieldset className="log-form-section">
      <legend className="field-label">本数</legend>
      <div className="score-row">
        <span className="score-value">{value}</span>
        <span className="score-unit">本</span>
        <div className="stepper">
          <IconButton
            label="本数を減らす"
            size="icon-lg"
            disabled={value <= BOTTLE_COUNT_MIN}
            onClick={() => onChange(Math.max(BOTTLE_COUNT_MIN, value - 1))}
          >
            <Minus size={22} />
          </IconButton>
          <IconButton
            label="本数を増やす"
            size="icon-lg"
            disabled={value >= BOTTLE_COUNT_MAX}
            onClick={() => onChange(Math.min(BOTTLE_COUNT_MAX, value + 1))}
          >
            <Plus size={22} />
          </IconButton>
        </div>
      </div>
    </fieldset>
  );
}
