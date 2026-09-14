import { Minus, Plus, RotateCw } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { clampAngleDegrees, stepAngleDegrees, wrapAngleDegrees } from "@/client/lib/photo/cutout-angle.ts";
import { PHOTO_CUTOUT_ANGLE_MAX, PHOTO_CUTOUT_ANGLE_MIN } from "@/shared/constants.ts";

const SLIDER_ID = "photo-cutout-angle";

export function PhotoEditAngleControls(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  degrees: number;
  autoApplied: boolean;
  disabled?: boolean;
  onChange: (degrees: number) => void;
}): ReactNode {
  useEffect(() => {
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, []);

  return (
    <div className="photo-edit-angle">
      <div className="photo-edit-toggles">
        <button
          type="button"
          className={input.open ? "chip is-on" : "chip"}
          aria-pressed={input.open}
          disabled={input.disabled}
          onClick={() => input.onOpenChange(!input.open)}
        >
          {input.open ? "✓ " : ""}
          角度を調整
        </button>
      </div>
      {input.autoApplied ? (
        <p className="photo-edit-note" role="status">
          自動で直立にしました
          <button
            type="button"
            className="header-text-link photo-edit-angle-undo"
            disabled={input.disabled}
            onClick={() => input.onChange(0)}
          >
            自動補正を取り消す
          </button>
        </p>
      ) : null}
      {input.open ? (
        <div className="photo-edit-angle-panel">
          <label className="photo-edit-angle-label" htmlFor={SLIDER_ID}>
            角度
            <output htmlFor={SLIDER_ID} className="photo-edit-angle-value">
              {input.degrees}°
            </output>
          </label>
          <div className="photo-edit-angle-slider-row">
            <IconButton
              label="1度左へ"
              size="icon-lg"
              disabled={input.disabled || input.degrees <= PHOTO_CUTOUT_ANGLE_MIN}
              onClick={() => input.onChange(stepAngleDegrees(input.degrees, -1))}
            >
              <Minus size={22} />
            </IconButton>
            <input
              id={SLIDER_ID}
              type="range"
              className="photo-edit-angle-slider"
              min={PHOTO_CUTOUT_ANGLE_MIN}
              max={PHOTO_CUTOUT_ANGLE_MAX}
              step={1}
              value={input.degrees}
              aria-label="切り抜きの角度（-180〜180度）"
              aria-valuemin={PHOTO_CUTOUT_ANGLE_MIN}
              aria-valuemax={PHOTO_CUTOUT_ANGLE_MAX}
              aria-valuenow={input.degrees}
              aria-valuetext={`${input.degrees}度`}
              disabled={input.disabled}
              onChange={(event) => input.onChange(clampAngleDegrees(Number(event.target.value)))}
              onPointerUp={() => document.body.style.removeProperty("overflow")}
              onPointerCancel={() => document.body.style.removeProperty("overflow")}
            />
            <IconButton
              label="1度右へ"
              size="icon-lg"
              disabled={input.disabled || input.degrees >= PHOTO_CUTOUT_ANGLE_MAX}
              onClick={() => input.onChange(stepAngleDegrees(input.degrees, 1))}
            >
              <Plus size={22} />
            </IconButton>
          </div>
          <div className="photo-edit-angle-actions">
            <button
              type="button"
              className="chip"
              disabled={input.disabled}
              onClick={() => input.onChange(wrapAngleDegrees(input.degrees + 90))}
            >
              <RotateCw size={16} aria-hidden />
              90度回転
            </button>
            <button
              type="button"
              className="chip"
              disabled={input.disabled || input.degrees === 0}
              onClick={() => input.onChange(0)}
            >
              0度へ戻す
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
