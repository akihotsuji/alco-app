import { Switch } from "@/client/components/ui/switch.tsx";
import { usePushNotifications } from "@/client/hooks/use-web-push.ts";
import { isPushSwitchDisabled, pushSettingsCaption } from "@/client/lib/web-push.ts";
import { PUSH_UI_COPY } from "@/shared/web-push.ts";

/** 設定 S23（spec/screen-designs/06-settings.md）。画面を開いただけでは許可を求めない */
export function PushNotificationPrefRow() {
  const push = usePushNotifications();
  const disabled = isPushSwitchDisabled(push);

  return (
    <div className="settings-row settings-row-stack">
      <span className="settings-row-main">
        <span>{PUSH_UI_COPY.settingsLabel}</span>
        <Switch
          label={PUSH_UI_COPY.settingsLabel}
          checked={push.on}
          disabled={disabled}
          onChange={(value) => {
            if (value) {
              void push.enable();
            } else {
              void push.disable();
            }
          }}
        />
      </span>
      <span className="settings-caption" aria-live="polite">
        {pushSettingsCaption(push)}
      </span>
    </div>
  );
}
