import { useMemo, useState } from "react";
import { Switch } from "@/client/components/ui/switch.tsx";
import { haptic, isHapticSupported } from "@/client/lib/haptic.ts";
import { getHapticPref, setHapticPref } from "@/client/lib/preferences.ts";

export function HapticPrefRow() {
  const supported = useMemo(() => isHapticSupported(), []);
  const [enabled, setEnabled] = useState(getHapticPref);

  return (
    <div className="settings-row settings-row-stack">
      <span className="settings-row-main">
        <span>触感フィードバック</span>
        <Switch
          label="触感フィードバック"
          checked={enabled}
          disabled={!supported}
          onChange={(value) => {
            setEnabled(value);
            setHapticPref(value);
            if (value) {
              haptic("light");
            }
          }}
        />
      </span>
      <span className="settings-caption">
        {supported ? "対応端末（Android）で有効" : "この端末では使えません"}
      </span>
    </div>
  );
}
