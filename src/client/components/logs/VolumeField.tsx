import { useEffect, useRef, useState } from "react";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { isManualVolume, volumeChipValues } from "@/client/lib/log-form.ts";
import { VOLUME_ML_MAX, VOLUME_ML_MIN } from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";

type VolumeFieldProps = {
  drinkType: DrinkType;
  value: number | null;
  error?: string;
  onChange: (value: number | null) => void;
};

function parseVolume(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** N4: スコア 40px + 種類の量チップ + ボトル量 375 / 750 / 1500 + 「手入力」（数値キーボード、1〜5000 整数） */
export function VolumeField({ drinkType, value, error, onChange }: VolumeFieldProps) {
  const manual = isManualVolume(drinkType, value);
  const [manualOpen, setManualOpen] = useState(manual);
  const [focusRequested, setFocusRequested] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 種類が変わってチップ値になったら手入力欄を閉じ、チップに無い値になれば開く
  useEffect(() => {
    setManualOpen(manual);
  }, [manual]);

  useEffect(() => {
    if (manualOpen && focusRequested) {
      inputRef.current?.focus();
      setFocusRequested(false);
    }
  }, [manualOpen, focusRequested]);

  function openManual() {
    setManualOpen(true);
    setFocusRequested(true);
  }

  return (
    <fieldset className="log-form-section">
      <legend className="field-label">量</legend>
      <div className="score-row">
        {manualOpen ? (
          <>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              className="score-input"
              aria-label="量（ml）"
              aria-invalid={error ? true : undefined}
              min={VOLUME_ML_MIN}
              max={VOLUME_ML_MAX}
              step={1}
              value={value ?? ""}
              onChange={(event) => onChange(parseVolume(event.target.value))}
            />
            <span className="score-unit">ml</span>
          </>
        ) : (
          <button type="button" className="score-button" onClick={openManual}>
            <span className="score-value">{value ?? "—"}</span>
            <span className="score-unit">ml</span>
          </button>
        )}
      </div>
      <div className="chip-row">
        {volumeChipValues(drinkType).map((chip) => (
          <Chip
            key={chip}
            selected={!manualOpen && value === chip}
            onSelect={() => {
              setManualOpen(false);
              onChange(chip);
            }}
          >
            {chip}
          </Chip>
        ))}
        <Chip selected={manualOpen} onSelect={openManual}>
          手入力
        </Chip>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
