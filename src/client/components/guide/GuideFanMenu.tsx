import type { CSSProperties } from "react";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { GUIDE_TOUR_LABELS, GUIDE_TOURS, type GuideTour } from "@/client/lib/first-run-guide.ts";

const FAN_ANGLES = [-48, 0, 48] as const;

type GuideFanMenuProps = {
  onSelect: (tour: GuideTour) => void;
};

/** 設定「使い方を見る」から機能名を扇状に出す */
export function GuideFanMenu({ onSelect }: GuideFanMenuProps) {
  const guide = useFirstRunGuide();
  if (!guide.pickerOpen) {
    return null;
  }

  return (
    <div className="guide-fan">
      <button
        type="button"
        className="guide-fan-backdrop"
        aria-label="閉じる"
        onClick={guide.closePicker}
      />
      <div className="guide-fan-items" role="menu" aria-label="使い方">
        {GUIDE_TOURS.map((tour, index) => (
          <button
            key={tour}
            type="button"
            role="menuitem"
            className="guide-fan-item"
            style={
              {
                "--fan-deg": `${FAN_ANGLES[index] ?? 0}deg`,
                "--fan-index": String(index),
              } as CSSProperties
            }
            onClick={() => onSelect(tour)}
          >
            {GUIDE_TOUR_LABELS[tour]}
          </button>
        ))}
      </div>
    </div>
  );
}
