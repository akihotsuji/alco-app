import { useState } from "react";
import { Chip } from "@/client/components/ui/Chip.tsx";
import { getThemePref, setThemePref } from "@/client/lib/preferences.ts";
import { THEME_PREFS, type ThemePref } from "@/shared/constants.ts";

const LABELS: Record<ThemePref, string> = {
  system: "端末に従う",
  light: "ライト",
  dark: "ダーク",
};

/** 外観（06-settings S10）。3 択なのでチップ列（00-common 2.6）。反映は lib/theme.ts が PREF_CHANGE_EVENT で行う */
export function ThemePrefRow() {
  const [pref, setPref] = useState(getThemePref);

  function select(value: ThemePref) {
    setPref(value);
    setThemePref(value);
  }

  return (
    <fieldset className="settings-row settings-row-stack settings-fieldset">
      <legend className="settings-legend">外観</legend>
      <div className="chip-row chip-row-wrap">
        {THEME_PREFS.map((value) => (
          <Chip key={value} selected={pref === value} onSelect={() => select(value)}>
            {LABELS[value]}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
