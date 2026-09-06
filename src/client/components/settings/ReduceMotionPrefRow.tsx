import { useState } from "react";
import { useOsPrefersReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { getReduceMotionPref, setReduceMotionPref } from "@/client/lib/preferences.ts";
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
    <div className="settings-row settings-row-stack">
      <span>動きを減らす</span>
      <div className="settings-segment">
        {REDUCE_MOTION_PREFS.map((value) => {
          const selected = pref === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              className={selected ? "settings-segment-option is-on" : "settings-segment-option"}
              onClick={() => select(value)}
            >
              {LABELS[value]}
            </button>
          );
        })}
      </div>
      {osReduce ? <span className="settings-caption">端末の設定で動きが減っています</span> : null}
    </div>
  );
}
