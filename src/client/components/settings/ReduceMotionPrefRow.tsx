import { useState } from "react";
import { useOsPrefersReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { getReduceMotionPref, setReduceMotionPref } from "@/client/lib/preferences.ts";
import { preventPointerFocus } from "@/client/lib/prevent-pointer-focus.ts";
import { REDUCE_MOTION_PREFS, type ReduceMotionPref } from "@/shared/constants.ts";

const LABELS: Record<ReduceMotionPref, string> = {
  system: "端末の設定に従う",
  always: "常に減らす",
};

export function ReduceMotionPrefRow() {
  const osReduce = useOsPrefersReducedMotion();
  const [pref, setPref] = useState(getReduceMotionPref);

  function select(value: ReduceMotionPref) {
    setPref(value);
    setReduceMotionPref(value);
  }

  return (
    <fieldset className="settings-row settings-row-stack settings-fieldset">
      <legend className="settings-legend">動きを減らす</legend>
      <div className="settings-segment">
        {REDUCE_MOTION_PREFS.map((value) => {
          const selected = pref === value;
          return (
            <label
              key={value}
              className={selected ? "settings-segment-option is-on" : "settings-segment-option"}
            >
              <input
                type="radio"
                className="settings-segment-radio"
                name="reduce-motion"
                checked={selected}
                onPointerDown={(event) => {
                  preventPointerFocus(event);
                  select(value);
                }}
                onMouseDown={preventPointerFocus}
                onPointerUp={(event) => {
                  event.currentTarget.blur();
                }}
                onChange={() => select(value)}
              />
              {LABELS[value]}
            </label>
          );
        })}
      </div>
      {osReduce ? <span className="settings-caption">端末の設定で動きが減っています</span> : null}
    </fieldset>
  );
}
