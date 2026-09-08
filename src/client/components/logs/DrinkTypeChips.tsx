import { Chip } from "@/client/components/ui/Chip.tsx";
import { haptic } from "@/client/lib/haptic.ts";
import { DRINK_TYPE_LABELS, DRINK_TYPES, type DrinkType } from "@/shared/constants.ts";

type DrinkTypeChipsProps = {
  value: DrinkType | null;
  guideTarget?: string;
  onChange: (drinkType: DrinkType) => void;
};

/** N3: 種類チップ（12 種、横スクロール）。選択で量・度数の上書きは呼び元（applyDrinkType）が行う */
export function DrinkTypeChips({ value, guideTarget, onChange }: DrinkTypeChipsProps) {
  return (
    <fieldset className="log-form-section" data-guide-target={guideTarget}>
      <legend className="field-label">種類</legend>
      <div className="chip-row">
        {DRINK_TYPES.map((type) => (
          <Chip
            key={type}
            selected={type === value}
            onSelect={() => {
              if (type !== value) {
                haptic("light");
                onChange(type);
              }
            }}
          >
            {DRINK_TYPE_LABELS[type]}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
