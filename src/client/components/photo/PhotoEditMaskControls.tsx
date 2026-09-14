import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import type { PhotoSourceOrigin } from "@/client/lib/photo/cutout-mask-hold.ts";
import type { MaskEditTool } from "@/client/lib/photo/cutout-mask-session.ts";
import { CUTOUT_MASK_EDIT_MESSAGES, PHOTO_CUTOUT_MASK_EDIT } from "@/shared/constants.ts";

const BRUSH_SLIDER_ID = "photo-cutout-brush-size";

export function PhotoEditMaskControls(input: {
  tool: MaskEditTool;
  onToolChange: (tool: MaskEditTool) => void;
  brushRadius: number;
  onBrushRadiusChange: (radius: number) => void;
  showSource: boolean;
  onShowSourceChange: (value: boolean) => void;
  origin: PhotoSourceOrigin;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  disabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}): ReactNode {
  const overlayLabel =
    input.origin === "processed"
      ? CUTOUT_MASK_EDIT_MESSAGES.processedOverlay
      : CUTOUT_MASK_EDIT_MESSAGES.sourceOverlay;
  return (
    <div className="photo-edit-mask-controls">
      <p className="photo-edit-note">{CUTOUT_MASK_EDIT_MESSAGES.orientation}</p>
      <fieldset className="photo-edit-toggles">
        <legend className="visually-hidden">切り抜き修正ツール</legend>
        <ToolChip
          label={CUTOUT_MASK_EDIT_MESSAGES.restore}
          pressed={input.tool === "restore"}
          disabled={input.disabled}
          onPress={() => input.onToolChange("restore")}
        />
        <ToolChip
          label={CUTOUT_MASK_EDIT_MESSAGES.erase}
          pressed={input.tool === "erase"}
          disabled={input.disabled}
          onPress={() => input.onToolChange("erase")}
        />
        <ToolChip
          label={CUTOUT_MASK_EDIT_MESSAGES.pan}
          pressed={input.tool === "pan"}
          disabled={input.disabled}
          onPress={() => input.onToolChange("pan")}
        />
      </fieldset>
      <p className="photo-edit-note">{CUTOUT_MASK_EDIT_MESSAGES.describe}</p>
      <div className="photo-edit-angle-panel">
        <label className="photo-edit-angle-label" htmlFor={BRUSH_SLIDER_ID}>
          {CUTOUT_MASK_EDIT_MESSAGES.brushSize}
          <output htmlFor={BRUSH_SLIDER_ID} className="photo-edit-angle-value">
            {input.brushRadius}
          </output>
        </label>
        <div className="photo-edit-angle-slider-row">
          <input
            id={BRUSH_SLIDER_ID}
            type="range"
            className="photo-edit-angle-slider"
            min={PHOTO_CUTOUT_MASK_EDIT.brushRadiusMin}
            max={PHOTO_CUTOUT_MASK_EDIT.brushRadiusMax}
            step={1}
            value={input.brushRadius}
            aria-label={CUTOUT_MASK_EDIT_MESSAGES.brushSize}
            aria-valuemin={PHOTO_CUTOUT_MASK_EDIT.brushRadiusMin}
            aria-valuemax={PHOTO_CUTOUT_MASK_EDIT.brushRadiusMax}
            aria-valuenow={input.brushRadius}
            disabled={input.disabled}
            onChange={(event) => input.onBrushRadiusChange(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="photo-edit-toggles">
        <IconButton
          label={CUTOUT_MASK_EDIT_MESSAGES.zoomOut}
          disabled={input.disabled || input.zoom <= PHOTO_CUTOUT_MASK_EDIT.zoomMin}
          onClick={input.onZoomOut}
        >
          <Minus size={20} />
        </IconButton>
        <IconButton
          label={CUTOUT_MASK_EDIT_MESSAGES.zoomIn}
          disabled={input.disabled || input.zoom >= PHOTO_CUTOUT_MASK_EDIT.zoomMax}
          onClick={input.onZoomIn}
        >
          <Plus size={20} />
        </IconButton>
        <button type="button" className="chip" disabled={input.disabled} onClick={input.onZoomFit}>
          {CUTOUT_MASK_EDIT_MESSAGES.zoomFit}
        </button>
      </div>
      <div className="photo-edit-toggles">
        <ToolChip
          label={overlayLabel}
          pressed={input.showSource}
          disabled={input.disabled}
          onPress={() => input.onShowSourceChange(!input.showSource)}
        />
      </div>
      <div className="photo-edit-toggles">
        <button
          type="button"
          className="header-text-link"
          disabled={input.disabled || !input.canUndo}
          onClick={input.onUndo}
        >
          {CUTOUT_MASK_EDIT_MESSAGES.undo}
        </button>
        <button
          type="button"
          className="header-text-link"
          disabled={input.disabled || !input.canRedo}
          onClick={input.onRedo}
        >
          {CUTOUT_MASK_EDIT_MESSAGES.redo}
        </button>
        <button
          type="button"
          className="header-text-link"
          disabled={input.disabled || !input.canReset}
          onClick={input.onReset}
        >
          {CUTOUT_MASK_EDIT_MESSAGES.reset}
        </button>
      </div>
    </div>
  );
}

function ToolChip({
  label,
  pressed,
  disabled,
  onPress,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className={pressed ? "chip is-on" : "chip"}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
    >
      {pressed ? "✓ " : ""}
      {label}
    </button>
  );
}
