import { Switch } from "@/client/components/ui/switch.tsx";
import { SOCIAL_COPY } from "@/shared/social.ts";

type ShareFieldProps = {
  shareOn: boolean;
  onShareOnChange: (value: boolean) => void;
  canShare: boolean;
  reason?: string | null;
  preview?: string | null;
  alreadyShared?: boolean;
};

export function ShareField({
  shareOn,
  onShareOnChange,
  canShare,
  reason,
  preview,
  alreadyShared = false,
}: ShareFieldProps) {
  return (
    <section className="share-field">
      <h2 className="share-field-title">{SOCIAL_COPY.shareTitle}</h2>
      <p className="share-field-hint">{SOCIAL_COPY.shareHint}</p>
      {alreadyShared ? <p className="share-field-hint">{SOCIAL_COPY.shareFollowsEdit}</p> : null}
      {canShare ? (
        <div className="settings-row settings-row-stack">
          <span className="settings-row-main">
            <span>{SOCIAL_COPY.shareSwitch}</span>
            <Switch label={SOCIAL_COPY.shareSwitch} checked={shareOn} onChange={onShareOnChange} />
          </span>
        </div>
      ) : (
        <p className="share-field-hint">
          {reason ?? "今は共有できません。個人の記録は保存できます。"}
        </p>
      )}
      {canShare && shareOn && preview ? <p className="share-field-preview">{preview}</p> : null}
      <p className="share-field-caption">{SOCIAL_COPY.shareNoBackfill}</p>
    </section>
  );
}

export function shareSaveLabel(shareOn: boolean, canShare: boolean, fallback: string): string {
  if (canShare && shareOn) {
    return SOCIAL_COPY.saveAndShare;
  }
  return fallback === "保存する" ? SOCIAL_COPY.saveOnly : fallback;
}
