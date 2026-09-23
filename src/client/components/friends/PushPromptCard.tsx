import { useId, useState } from "react";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { usePushNotifications } from "@/client/hooks/use-web-push.ts";
import {
  dismissPushPrompt,
  isPushPromptDismissed,
  shouldShowPushPrompt,
} from "@/client/lib/web-push.ts";
import { PUSH_UI_COPY } from "@/shared/web-push.ts";

/** 通知画面 N1（spec/screen-designs/13-friends.md）。一度きり。押したときだけ許可を求める */
export function PushPromptCard() {
  const push = usePushNotifications();
  const { showToast } = useToast();
  const titleId = useId();
  const [dismissed, setDismissed] = useState(isPushPromptDismissed);
  const [showDenied, setShowDenied] = useState(false);

  function close() {
    dismissPushPrompt();
    setDismissed(true);
  }

  if (showDenied) {
    return (
      <section className="push-prompt" aria-label={PUSH_UI_COPY.promptTitle}>
        <p className="push-prompt-body" role="status">
          {PUSH_UI_COPY.promptDenied}
        </p>
        <div className="push-prompt-actions">
          <Button type="button" variant="secondary" onClick={() => setShowDenied(false)}>
            {PUSH_UI_COPY.promptClose}
          </Button>
        </div>
      </section>
    );
  }

  if (!shouldShowPushPrompt({ ...push, dismissed })) {
    return null;
  }

  return (
    <section className="push-prompt" aria-labelledby={titleId}>
      <h2 className="push-prompt-title" id={titleId}>
        {PUSH_UI_COPY.promptTitle}
      </h2>
      <p className="push-prompt-body">{PUSH_UI_COPY.promptBody}</p>
      {push.failed ? (
        <p className="push-prompt-body" role="alert">
          {PUSH_UI_COPY.failed}
        </p>
      ) : null}
      <div className="push-prompt-actions">
        <Button
          type="button"
          disabled={push.busy}
          onClick={() => {
            void push.enable().then((result) => {
              if (result === "enabled") {
                close();
                showToast({ message: PUSH_UI_COPY.enabledToast });
              } else if (result === "denied") {
                close();
                setShowDenied(true);
              } else if (result === "dismissed") {
                close();
              }
            });
          }}
        >
          {PUSH_UI_COPY.promptAccept}
        </Button>
        <Button type="button" variant="ghost" disabled={push.busy} onClick={close}>
          {PUSH_UI_COPY.promptLater}
        </Button>
      </div>
    </section>
  );
}
