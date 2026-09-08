import { useState } from "react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { extraVolumeChips, isManualVolume, primaryVolumeChips } from "@/client/lib/log-form.ts";
import { VOLUME_ML_MAX, VOLUME_ML_MIN } from "@/shared/alcohol.ts";
import type { DrinkType } from "@/shared/constants.ts";

type VolumeFieldProps = {
  drinkType: DrinkType;
  value: number | null;
  error?: string;
  guideTarget?: string;
  onChange: (value: number | null) => void;
};

function parseVolume(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** N4: 数値 + ml を一つの入力。種類のよく使う量を近くに、残りは「その他」 */
export function VolumeField({ drinkType, value, error, guideTarget, onChange }: VolumeFieldProps) {
  const primary = primaryVolumeChips(drinkType);
  const extra = extraVolumeChips(drinkType);
  const extrasOpenNeeded = extra.includes(value ?? -1);
  const [extrasOpen, setExtrasOpen] = useState(extrasOpenNeeded);

  return (
    <fieldset className="log-form-section" data-guide-target={guideTarget}>
      <legend>
        <FieldLabel htmlFor="log-volume-ml">飲んだ量</FieldLabel>
      </legend>
      <div className="unit-field">
        <input
          id="log-volume-ml"
          type="number"
          inputMode="numeric"
          className="unit-field-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy("log-volume-ml", error)}
          min={VOLUME_ML_MIN}
          max={VOLUME_ML_MAX}
          step={1}
          value={value ?? ""}
          onChange={(event) => onChange(parseVolume(event.target.value))}
        />
        <span className="unit-field-suffix">ml</span>
      </div>
      {primary.length > 0 || extra.length > 0 ? (
        <div className="chip-row chip-row-wrap">
          {primary.map((chip) => (
            <Chip
              key={chip}
              selected={value === chip}
              onSelect={() => {
                onChange(chip);
              }}
            >
              {chip} ml
            </Chip>
          ))}
          {extra.length > 0 ? (
            <Chip
              selected={extrasOpen || extrasOpenNeeded}
              onSelect={() => {
                setExtrasOpen((current) => !current);
              }}
            >
              その他
            </Chip>
          ) : null}
        </div>
      ) : null}
      {extrasOpen || extrasOpenNeeded ? (
        <div className="chip-row chip-row-wrap">
          {extra.map((chip) => (
            <Chip
              key={chip}
              selected={value === chip}
              onSelect={() => {
                onChange(chip);
              }}
            >
              {chip} ml
            </Chip>
          ))}
        </div>
      ) : null}
      {isManualVolume(drinkType, value) && value !== null ? (
        <p className="field-hint">手入力中</p>
      ) : null}
      <FieldError id="log-volume-ml" error={error} />
    </fieldset>
  );
}
