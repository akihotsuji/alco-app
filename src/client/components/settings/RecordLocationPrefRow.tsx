import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/client/components/ui/switch.tsx";
import {
  type GeolocationPermission,
  isGeolocationSupported,
  queryGeolocationPermission,
  recordLocationCaption,
  requestCurrentPosition,
} from "@/client/lib/geolocation.ts";
import { getRecordLocationPref, setRecordLocationPref } from "@/client/lib/preferences.ts";

export function RecordLocationPrefRow() {
  const supported = useMemo(() => isGeolocationSupported(), []);
  const [enabled, setEnabled] = useState(getRecordLocationPref);
  const [permission, setPermission] = useState<GeolocationPermission>("unknown");

  useEffect(() => {
    if (!supported) {
      return;
    }
    void queryGeolocationPermission().then(setPermission);
  }, [supported]);

  return (
    <div className="settings-row settings-row-stack">
      <span className="settings-row-main">
        <span>現在地を記録する</span>
        <Switch
          label="現在地を記録する"
          checked={enabled}
          disabled={!supported}
          onChange={(value) => {
            setEnabled(value);
            setRecordLocationPref(value);
            if (value) {
              void requestCurrentPosition().then(() => {
                void queryGeolocationPermission().then(setPermission);
              });
            }
          }}
        />
      </span>
      <span className="settings-caption">{recordLocationCaption(supported, permission)}</span>
    </div>
  );
}
